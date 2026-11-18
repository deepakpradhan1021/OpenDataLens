"""
OpenDataLens — Lightweight Production Telemetry & System Monitoring Engine
Phase 7.2: Zero-Dependency Resource Telemetry & Performance Tracking
Designed for Render 512 MB RAM Free Tier & Production Verification
"""

import os
import sys
import time
import math
import hmac
import logging
import threading
from typing import Dict, List, Optional, Any, Tuple
from collections import deque, defaultdict
from datetime import datetime, timezone

logger = logging.getLogger("OpenDataLens.Telemetry")

# Memory Protection Thresholds (Render 512 MB Free Tier Container)
MEMORY_WARNING_MB = float(os.getenv("TELEMETRY_MEM_WARNING_MB", "350.0"))
MEMORY_CRITICAL_MB = float(os.getenv("TELEMETRY_MEM_CRITICAL_MB", "450.0"))
LATENCY_BUFFER_SIZE = int(os.getenv("TELEMETRY_LATENCY_BUFFER_SIZE", "500"))

# Admin Rate Limiting Constraints
ADMIN_MAX_FAILURES = 5
ADMIN_LOCKOUT_SECONDS = 15 * 60  # 15 minutes


class TelemetryCollector:
    """
    In-memory, bounded, zero-dependency telemetry engine.
    Tracks process memory (RSS), CPU %, latency percentiles, endpoint throughput,
    error rates, and operational event counters without external database dependencies.
    """

    _instance: Optional["TelemetryCollector"] = None
    _lock = threading.Lock()

    def __new__(cls) -> "TelemetryCollector":
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(TelemetryCollector, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return

        self._start_time = time.time()
        self._last_cpu_time = time.process_time()
        self._last_wall_time = time.time()
        self._cpu_percent_cached = 0.0

        # Latency Ring Buffer
        self._latency_buffer: deque = deque(maxlen=LATENCY_BUFFER_SIZE)

        # Status Code Counters
        self._status_counts: Dict[str, int] = defaultdict(int)

        # Route Metrics: path_template -> {"count": int, "total_latency": float, "errors": int, "max_latency": float}
        self._route_metrics: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"count": 0, "total_latency": 0.0, "errors": 0, "max_latency": 0.0}
        )

        # Failure & Lifecycle Event Counters
        self._event_counters: Dict[str, int] = {
            "api_failures": 0,
            "upload_failures": 0,
            "dataset_processing_failures": 0,
            "ml_training_failures": 0,
            "export_failures": 0,
            "storage_failures": 0,
        }

        # Active ML jobs / workloads count
        self._active_jobs = 0

        # Admin Auth Failed Attempts: ip -> {"count": int, "locked_until": float}
        self._admin_auth_attempts: Dict[str, Dict[str, Any]] = {}

        self._initialized = True
        logger.info(
            f"TelemetryCollector initialized (RAM Limits: Warning={MEMORY_WARNING_MB}MB, Critical={MEMORY_CRITICAL_MB}MB, Buffer={LATENCY_BUFFER_SIZE})"
        )

    # -------------------------------------------------------------------------
    # Resource Measurement (Memory & CPU)
    # -------------------------------------------------------------------------

    def get_process_memory_mb(self) -> float:
        """
        Calculates Resident Set Size (RSS) memory in Megabytes.
        - Linux (/proc/self/status VmRSS): 0% overhead, precise for Render containers.
        - Windows (psapi.GetProcessMemoryInfo): accurate for local Windows dev.
        - Unix (resource.getrusage): fallback for macOS / BSD.
        """
        # 1. Linux / Render container check
        if sys.platform.startswith("linux"):
            try:
                with open("/proc/self/status", "r") as f:
                    for line in f:
                        if line.startswith("VmRSS:"):
                            parts = line.split()
                            if len(parts) >= 2:
                                kb = float(parts[1])
                                return round(kb / 1024.0, 2)
            except Exception:
                pass

        # 2. Windows development check
        if sys.platform == "win32":
            try:
                import ctypes
                from ctypes import wintypes

                class PROCESS_MEMORY_COUNTERS_EX(ctypes.Structure):
                    _fields_ = [
                        ("cb", wintypes.DWORD),
                        ("PageFaultCount", wintypes.DWORD),
                        ("PeakWorkingSetSize", ctypes.c_size_t),
                        ("WorkingSetSize", ctypes.c_size_t),
                        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                        ("PagefileUsage", ctypes.c_size_t),
                        ("PeakPagefileUsage", ctypes.c_size_t),
                        ("PrivateUsage", ctypes.c_size_t),
                    ]

                psapi = ctypes.WinDLL("psapi")
                kernel32 = ctypes.WinDLL("kernel32")
                kernel32.GetCurrentProcess.restype = wintypes.HANDLE
                psapi.GetProcessMemoryInfo.argtypes = [
                    wintypes.HANDLE,
                    ctypes.POINTER(PROCESS_MEMORY_COUNTERS_EX),
                    wintypes.DWORD,
                ]
                psapi.GetProcessMemoryInfo.restype = wintypes.BOOL

                handle = kernel32.GetCurrentProcess()
                counters = PROCESS_MEMORY_COUNTERS_EX()
                counters.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS_EX)
                if psapi.GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb):
                    return round(counters.WorkingSetSize / (1024.0 * 1024.0), 2)
            except Exception:
                pass

        # 3. Unix fallback via resource module
        try:
            import resource
            usage = resource.getrusage(resource.RUSAGE_SELF)
            # On macOS ru_maxrss is in bytes, on Linux in kilobytes
            if sys.platform == "darwin":
                return round(usage.ru_maxrss / (1024.0 * 1024.0), 2)
            else:
                return round(usage.ru_maxrss / 1024.0, 2)
        except Exception:
            return 45.0  # Safe nominal fallback

    def get_cpu_percent(self) -> float:
        """
        Calculates process CPU usage % over the last query interval.
        """
        now_wall = time.time()
        now_cpu = time.process_time()

        delta_wall = now_wall - self._last_wall_time
        delta_cpu = now_cpu - self._last_cpu_time

        if delta_wall > 0.5:
            num_cores = os.cpu_count() or 1
            cpu_pct = (delta_cpu / delta_wall) / num_cores * 100.0
            self._cpu_percent_cached = round(min(100.0, max(0.0, cpu_pct)), 1)
            self._last_wall_time = now_wall
            self._last_cpu_time = now_cpu

        return self._cpu_percent_cached

    def get_memory_status(self) -> Tuple[str, float]:
        """
        Returns status ('healthy', 'warning', 'critical') and current RSS MB.
        """
        rss_mb = self.get_process_memory_mb()
        if rss_mb >= MEMORY_CRITICAL_MB:
            return "critical", rss_mb
        elif rss_mb >= MEMORY_WARNING_MB:
            return "warning", rss_mb
        return "healthy", rss_mb

    def is_memory_critical(self) -> bool:
        """
        True if current process memory exceeds MEMORY_CRITICAL_MB.
        Used for proactive memory protection before executing large memory-heavy tasks.
        """
        return self.get_process_memory_mb() >= MEMORY_CRITICAL_MB

    # -------------------------------------------------------------------------
    # Latency & Request Tracking
    # -------------------------------------------------------------------------

    def record_request(self, route_template: str, status_code: int, duration_ms: float) -> None:
        """
        Records an incoming API request completion.
        Uses route_template (e.g. /api/curated/{id}) to prevent cardinality explosion.
        """
        with self._lock:
            # Latency Buffer
            self._latency_buffer.append(round(duration_ms, 2))

            # Status Code Categorization
            category = f"{status_code // 100}xx"
            self._status_counts[category] += 1
            self._status_counts[f"status_{status_code}"] += 1

            # Route Metrics
            route = self._route_metrics[route_template]
            route["count"] += 1
            route["total_latency"] += duration_ms
            if duration_ms > route["max_latency"]:
                route["max_latency"] = duration_ms
            if status_code >= 400:
                route["errors"] += 1

            # Event Failures Mapping
            if status_code >= 500:
                self._event_counters["api_failures"] += 1

    def increment_event(self, event_name: str) -> None:
        """
        Increments a specific operational failure or lifecycle counter.
        """
        with self._lock:
            if event_name in self._event_counters:
                self._event_counters[event_name] += 1
            else:
                self._event_counters[event_name] = 1

    # Convenience alias for increment_event
    record_event = increment_event

    def set_active_jobs(self, count: int) -> None:
        """
        Updates count of active ML training jobs or heavy compute tasks.
        """
        with self._lock:
            self._active_jobs = max(0, count)

    def change_active_jobs(self, delta: int) -> None:
        with self._lock:
            self._active_jobs = max(0, self._active_jobs + delta)

    # -------------------------------------------------------------------------
    # Percentile Calculations
    # -------------------------------------------------------------------------

    def get_latency_percentiles(self) -> Dict[str, float]:
        """
        Computes min, avg, p50, p95, p99, and max latency from the circular buffer.
        """
        with self._lock:
            buffer_copy = list(self._latency_buffer)

        if not buffer_copy:
            return {
                "count": 0,
                "min_ms": 0.0,
                "avg_ms": 0.0,
                "p50_ms": 0.0,
                "p95_ms": 0.0,
                "p99_ms": 0.0,
                "max_ms": 0.0,
            }

        sorted_latencies = sorted(buffer_copy)
        n = len(sorted_latencies)

        def percentile(p: float) -> float:
            idx = int(math.ceil((p / 100.0) * n)) - 1
            idx = max(0, min(idx, n - 1))
            return round(sorted_latencies[idx], 2)

        avg_lat = round(sum(sorted_latencies) / n, 2)

        return {
            "count": n,
            "min_ms": round(sorted_latencies[0], 2),
            "avg_ms": avg_lat,
            "p50_ms": percentile(50),
            "p95_ms": percentile(95),
            "p99_ms": percentile(99),
            "max_ms": round(sorted_latencies[-1], 2),
        }

    # -------------------------------------------------------------------------
    # Admin Authentication & Rate Limiting
    # -------------------------------------------------------------------------

    def check_admin_lockout(self, client_ip: str) -> Tuple[bool, int]:
        """
        Returns (is_locked, remaining_seconds).
        """
        with self._lock:
            info = self._admin_auth_attempts.get(client_ip)
            if not info:
                return False, 0

            locked_until = info.get("locked_until", 0)
            now = time.time()
            if now < locked_until:
                remaining = int(math.ceil(locked_until - now))
                return True, remaining
            return False, 0

    def verify_admin_key(self, provided_key: Optional[str], client_ip: str) -> Tuple[bool, str]:
        """
        Verifies admin key using constant-time comparison and enforces rate limiting.
        Returns (success: bool, error_reason: str).
        """
        configured_key = os.getenv("OPENDATALENS_ADMIN_KEY", "").strip()

        # Check if Admin Key is configured on server
        if not configured_key:
            return False, "unconfigured"

        # Check IP Lockout
        is_locked, remaining = self.check_admin_lockout(client_ip)
        if is_locked:
            return False, f"locked:{remaining}"

        if not provided_key:
            return False, "missing_key"

        # Constant-time comparison to prevent timing attacks
        valid = hmac.compare_digest(provided_key.encode("utf-8"), configured_key.encode("utf-8"))

        with self._lock:
            if valid:
                # Reset failure count on success
                self._admin_auth_attempts.pop(client_ip, None)
                return True, "authorized"
            else:
                # Increment failure count
                entry = self._admin_auth_attempts.setdefault(client_ip, {"count": 0, "locked_until": 0})
                entry["count"] += 1
                if entry["count"] >= ADMIN_MAX_FAILURES:
                    entry["locked_until"] = time.time() + ADMIN_LOCKOUT_SECONDS
                    logger.warning(
                        f"Admin rate limiter triggered for IP {client_ip}. Locked out for {ADMIN_LOCKOUT_SECONDS}s."
                    )
                    return False, f"locked:{ADMIN_LOCKOUT_SECONDS}"
                return False, "invalid_key"

    # -------------------------------------------------------------------------
    # Metrics Reset
    # -------------------------------------------------------------------------

    def reset_admin_lockouts(self) -> None:
        """
        Resets all tracked admin authentication failure attempts and lockouts.
        """
        with self._lock:
            self._admin_auth_attempts.clear()

    def reset_metrics(self) -> None:
        """
        Resets all latency buffers, throughput counters, route tables, and rate-limit lockouts.
        """
        with self._lock:
            self._latency_buffer.clear()
            self._status_counts.clear()
            self._route_metrics.clear()
            for k in self._event_counters:
                self._event_counters[k] = 0
            self._admin_auth_attempts.clear()
            logger.info("Telemetry metrics reset by admin.")

    # -------------------------------------------------------------------------
    # Snapshot Generation (Sanitized & Secret-Scrubbed)
    # -------------------------------------------------------------------------

    def get_telemetry_snapshot(self) -> Dict[str, Any]:
        """
        Returns a complete, sanitized operational snapshot.
        Guarantees zero leakage of private tokens, datasets, or authorization secrets.
        """
        now = time.time()
        uptime_seconds = int(now - self._start_time)
        memory_status, memory_rss_mb = self.get_memory_status()
        cpu_percent = self.get_cpu_percent()
        latency_info = self.get_latency_percentiles()

        with self._lock:
            # Top slow routes (sorted by max_latency descending, max 10)
            sorted_routes = []
            for path, stats in self._route_metrics.items():
                count = stats["count"]
                avg_l = round(stats["total_latency"] / count, 2) if count > 0 else 0.0
                sorted_routes.append({
                    "route": path,
                    "count": count,
                    "avg_latency_ms": avg_l,
                    "max_latency_ms": round(stats["max_latency"], 2),
                    "errors": stats["errors"],
                })
            sorted_routes.sort(key=lambda x: x["avg_latency_ms"], reverse=True)
            top_routes = sorted_routes[:10]

            total_reqs = sum(
                v for k, v in self._status_counts.items() if k in ("2xx", "3xx", "4xx", "5xx")
            )
            status_dist = {
                "2xx": self._status_counts.get("2xx", 0),
                "3xx": self._status_counts.get("3xx", 0),
                "4xx": self._status_counts.get("4xx", 0),
                "5xx": self._status_counts.get("5xx", 0),
            }

            events_copy = dict(self._event_counters)
            active_jobs = self._active_jobs

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "uptime_seconds": uptime_seconds,
            "system": {
                "memory_rss_mb": memory_rss_mb,
                "memory_status": memory_status,
                "memory_warning_threshold_mb": MEMORY_WARNING_MB,
                "memory_critical_threshold_mb": MEMORY_CRITICAL_MB,
                "cpu_percent": cpu_percent,
                "platform": sys.platform,
                "active_jobs": active_jobs,
            },
            "requests": {
                "total": total_reqs,
                "status_distribution": status_dist,
                "throughput_per_minute": round(
                    (total_reqs / (uptime_seconds / 60.0)) if uptime_seconds >= 60 else total_reqs, 2
                ),
            },
            "latency": latency_info,
            "slow_endpoints": top_routes,
            "events": events_copy,
            "limits": {
                "max_upload_size_mb": 25,
                "session_ttl_hours": 24,
                "render_ram_limit_mb": 512,
            },
        }


# Global Singleton Instance
telemetry_collector = TelemetryCollector()
