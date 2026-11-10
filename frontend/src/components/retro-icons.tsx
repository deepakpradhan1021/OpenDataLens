import React from "react";

interface IconProps {
  className?: string;
  size?: number;
}

// 1. Vintage CRT Computer with Scanlines (Media / Tech)
export function RetroMonitorIcon({ className = "", size = 36 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="3" y="4" width="30" height="22" rx="2" fill="#202227" stroke="#4B5563" strokeWidth="2" />
      <rect x="6" y="7" width="24" height="16" fill="#1864FF" />
      <path d="M7 10H29M7 13H29M7 16H29M7 19H29" stroke="#93C5FD" strokeWidth="1" strokeDasharray="2 1" />
      <rect x="15" y="26" width="6" height="4" fill="#9CA3AF" stroke="#374151" strokeWidth="1.5" />
      <rect x="10" y="30" width="16" height="3" fill="#D1D5DB" stroke="#374151" strokeWidth="1.5" />
    </svg>
  );
}

// 2. Pixel Heart on Document (Healthcare / Bio)
export function RetroHeartDocIcon({ className = "", size = 36 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="6" y="3" width="24" height="30" rx="1" fill="#F3F4F6" stroke="#111827" strokeWidth="2" />
      <path d="M6 8H30" stroke="#E5E7EB" strokeWidth="1.5" />
      {/* Pixel Heart */}
      <rect x="13" y="13" width="3" height="3" fill="#EF4444" />
      <rect x="16" y="13" width="3" height="3" fill="#EF4444" />
      <rect x="20" y="13" width="3" height="3" fill="#EF4444" />
      <rect x="23" y="13" width="3" height="3" fill="#EF4444" />
      <rect x="11" y="16" width="17" height="4" fill="#DC2626" />
      <rect x="13" y="20" width="13" height="3" fill="#DC2626" />
      <rect x="16" y="23" width="7" height="3" fill="#B91C1C" />
      <rect x="18" y="26" width="3" height="2" fill="#991B1B" />
      {/* Page Fold Accent */}
      <path d="M23 3L30 10H23V3Z" fill="#D1D5DB" stroke="#111827" strokeWidth="1.5" />
    </svg>
  );
}

// 3. Desk Robot / Lamp (Robotics / Automation)
export function RetroRobotIcon({ className = "", size = 36 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="5" y="4" width="26" height="28" fill="#F9FAFB" stroke="#111827" strokeWidth="2" />
      <rect x="13" y="7" width="10" height="8" fill="#3B82F6" stroke="#1E40AF" strokeWidth="1.5" />
      <circle cx="16" cy="11" r="1.5" fill="#FFFFFF" />
      <circle cx="20" cy="11" r="1.5" fill="#FFFFFF" />
      <path d="M18 15V22M14 22H22M18 22V27M12 27H24" stroke="#1F2937" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

// 4. Retro Rocket on Launchpad (Space / Science)
export function RetroRocketIcon({ className = "", size = 36 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="5" y="3" width="26" height="30" fill="#FFFFFF" stroke="#111827" strokeWidth="2" />
      <path d="M5 9H31M5 15H31M5 21H31M5 27H31" stroke="#E5E7EB" strokeWidth="1" />
      <path d="M11 3V33M17 3V33M23 3V33M29 3V33" stroke="#E5E7EB" strokeWidth="1" />
      <path d="M18 6C18 6 13 12 13 18H23C23 12 18 6 18 6Z" fill="#EF4444" stroke="#991B1B" strokeWidth="1.5" />
      <circle cx="18" cy="14" r="2" fill="#93C5FD" stroke="#1E40AF" strokeWidth="1" />
      <path d="M11 18L13 22H11V18ZM25 18L23 22H25V18Z" fill="#F59E0B" />
      <rect x="16" y="22" width="4" height="5" fill="#F97316" />
    </svg>
  );
}

// 5. Vintage Folder with Globe (Real Estate / Geo)
export function RetroFolderGlobeIcon({ className = "", size = 36 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M4 10H14L17 13H32V29H4V10Z" fill="#2563EB" stroke="#1E3A8A" strokeWidth="2" />
      <path d="M5 14H31V28H5V14Z" fill="#3B82F6" />
      <circle cx="18" cy="21" r="7" fill="#60A5FA" stroke="#1D4ED8" strokeWidth="1.5" />
      <path d="M13 21C13 24 18 27 18 27M18 15C18 15 23 18 23 21" stroke="#10B981" strokeWidth="1.5" fill="none" />
      <circle cx="18" cy="21" r="4" fill="#34D399" />
    </svg>
  );
}

// 6. Classic Macintosh with Gold Coin (Crypto / Web3)
export function RetroMacCoinIcon({ className = "", size = 36 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="7" y="5" width="22" height="26" rx="2" fill="#E5E7EB" stroke="#374151" strokeWidth="2" />
      <rect x="10" y="8" width="16" height="12" rx="1" fill="#1F2937" stroke="#111827" strokeWidth="1.5" />
      <circle cx="18" cy="14" r="4.5" fill="#FBBF24" stroke="#D97706" strokeWidth="1.2" />
      <text x="16.5" y="16.5" fontSize="6" fontWeight="bold" fill="#78350F" fontFamily="monospace">¢</text>
      <rect x="11" y="24" width="14" height="2" fill="#9CA3AF" />
    </svg>
  );
}

// 7. Dual Server Terminals (Enterprise)
export function RetroTerminalIcon({ className = "", size = 36 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="4" y="6" width="12" height="18" rx="1" fill="#3B82F6" stroke="#1E40AF" strokeWidth="1.5" />
      <rect x="18" y="4" width="14" height="20" rx="1" fill="#2563EB" stroke="#1E3A8A" strokeWidth="1.5" />
      <rect x="6" y="8" width="8" height="10" fill="#DBEAFE" />
      <rect x="20" y="6" width="10" height="12" fill="#BFDBFE" />
      <path d="M6 27H30M10 24V30M24 24V30" stroke="#374151" strokeWidth="2" />
    </svg>
  );
}

// 8. ATM / Banknotes Dispenser (Fintech / Finance)
export function RetroCashIcon({ className = "", size = 36 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="6" y="4" width="24" height="28" rx="1" fill="#E5E7EB" stroke="#374151" strokeWidth="2" />
      <rect x="9" y="8" width="18" height="6" fill="#1F2937" />
      <circle cx="18" cy="11" r="1.5" fill="#10B981" />
      <rect x="11" y="17" width="14" height="8" fill="#34D399" stroke="#059669" strokeWidth="1.5" />
      <text x="16" y="23.5" fontSize="7" fontWeight="bold" fill="#065F46" fontFamily="monospace">$</text>
      <rect x="9" y="27" width="18" height="2" fill="#6B7280" />
    </svg>
  );
}

// 9. Postage Stamp with Microscope (Climate Tech)
export function RetroMicroscopeIcon({ className = "", size = 36 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="6" y="4" width="24" height="28" fill="#F3F4F6" stroke="#4B5563" strokeWidth="2" strokeDasharray="2 2" />
      <rect x="10" y="8" width="16" height="20" fill="#E5E7EB" />
      <path d="M18 10L14 17H22L18 10Z" fill="#10B981" />
      <circle cx="18" cy="19" r="3" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="1" />
      <path d="M13 25H23" stroke="#374151" strokeWidth="2" />
    </svg>
  );
}

// 10. Puzzle Piece with Heart (Silvercare / Wellness)
export function RetroPuzzleHeartIcon({ className = "", size = 36 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="7" y="7" width="22" height="22" rx="2" fill="#D1D5DB" stroke="#111827" strokeWidth="2" />
      <rect x="12" y="12" width="12" height="12" fill="#1864FF" />
      <path d="M15 17C15 15.5 17 15 18 16.5C19 15 21 15.5 21 17C21 19 18 21 18 21C18 21 15 19 15 17Z" fill="#FFFFFF" />
    </svg>
  );
}

// 11. Pixel Dog (Pets / Consumer)
export function RetroDogIcon({ className = "", size = 36 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="6" y="6" width="24" height="24" fill="#FFFFFF" stroke="#111827" strokeWidth="2" />
      <rect x="12" y="11" width="3" height="4" fill="#3B82F6" />
      <rect x="15" y="13" width="7" height="6" fill="#60A5FA" />
      <rect x="22" y="15" width="4" height="3" fill="#3B82F6" />
      <rect x="14" y="19" width="3" height="6" fill="#1D4ED8" />
      <rect x="19" y="19" width="3" height="6" fill="#1D4ED8" />
      <rect x="21" y="12" width="2" height="4" fill="#1E40AF" />
    </svg>
  );
}

// 12. Identity Badges / Two User Profile Cards (Consumer)
export function RetroUsersIcon({ className = "", size = 36 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="4" y="6" width="28" height="24" rx="1" fill="#E5E7EB" stroke="#111827" strokeWidth="2" />
      {/* Top Banner */}
      <rect x="4" y="6" width="28" height="6" fill="#1864FF" />
      {/* User 1 Badge */}
      <rect x="8" y="15" width="8" height="9" fill="#FFFFFF" stroke="#374151" strokeWidth="1" />
      <circle cx="12" cy="18" r="1.8" fill="#3B82F6" />
      <path d="M9 23C9 21.5 10.5 21 12 21C13.5 21 15 21.5 15 23" fill="#1D4ED8" />
      {/* User 2 Badge */}
      <rect x="20" y="15" width="8" height="9" fill="#FFFFFF" stroke="#374151" strokeWidth="1" />
      <circle cx="24" cy="18" r="1.8" fill="#10B981" />
      <path d="M21 23C21 21.5 22.5 21 24 21C25.5 21 27 21.5 27 23" fill="#059669" />
    </svg>
  );
}

// 13. 3.5" Floppy Diskette (CSV Upload & Download)
export function RetroDisketteIcon({ className = "", size = 36 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="5" y="4" width="26" height="28" rx="2" fill="#1F2937" stroke="#111827" strokeWidth="2" />
      <rect x="10" y="4" width="16" height="11" fill="#9CA3AF" stroke="#4B5563" strokeWidth="1" />
      <rect x="13" y="6" width="3" height="7" fill="#1F2937" />
      <rect x="9" y="18" width="18" height="12" fill="#F9FAFB" stroke="#9CA3AF" strokeWidth="1" />
      <path d="M11 22H25M11 25H25M11 28H21" stroke="#3B82F6" strokeWidth="1.2" />
    </svg>
  );
}

// 14. Hugging Face Pixel Smiley
export function RetroHFIcon({ className = "", size = 36 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="5" y="5" width="26" height="26" rx="3" fill="#FBBF24" stroke="#D97706" strokeWidth="2" />
      <rect x="10" y="12" width="4" height="5" rx="1" fill="#78350F" />
      <rect x="22" y="12" width="4" height="5" rx="1" fill="#78350F" />
      <path d="M12 21C12 24.5 15 26.5 18 26.5C21 26.5 24 24.5 24 21" stroke="#78350F" strokeWidth="2.5" strokeLinecap="square" />
      <rect x="3" y="17" width="4" height="6" rx="1" fill="#F59E0B" />
      <rect x="29" y="17" width="4" height="6" rx="1" fill="#F59E0B" />
    </svg>
  );
}
