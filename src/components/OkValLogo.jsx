export default function OkValLogo({ size = 34, className = "", ...props }) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="OK-VAL logo"
      {...props}
    >
      <defs>
        <linearGradient
          id="navyGradient"
          x1="50"
          y1="15"
          x2="50"
          y2="85"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      <path
        d="M15 25C15 18 20 15 25 15H75C80 15 85 18 85 25V60C85 75 50 85 50 85C50 85 15 75 15 60V25Z"
        fill="url(#navyGradient)"
      />

      <path
        d="M50 15V85"
        stroke="#334155"
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />
      <path
        d="M15 45H85"
        stroke="#334155"
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />

      <path
        d="M35 35L50 70L65 35"
        stroke="#3b82f6"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M35 35L50 70L65 35"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
      />

      <rect
        x="30"
        y="20"
        width="40"
        height="2"
        rx="1"
        fill="#3b82f6"
        fillOpacity="0.5"
      />
    </svg>
  );
}