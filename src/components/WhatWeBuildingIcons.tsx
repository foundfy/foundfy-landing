interface IconProps {
  className?: string;
}

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconFind({ className = "" }: IconProps) {
  return (
    <svg
      width={34}
      height={34}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
    >
      <circle cx="14" cy="14" r="8.5" {...stroke} />
      <path d="M20.5 20.5L26 26" {...stroke} />
    </svg>
  );
}

export function IconUnderstand({ className = "" }: IconProps) {
  return (
    <svg
      width={34}
      height={34}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 9h20M6 16h14M6 23h8" {...stroke} />
      <path d="M24 16h2M27 16h1" {...stroke} />
    </svg>
  );
}

export function IconImprove({ className = "" }: IconProps) {
  return (
    <svg
      width={34}
      height={34}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
    >
      <path d="M9 23L23 9" {...stroke} />
      <path d="M14 9h9v9" {...stroke} />
    </svg>
  );
}

export function IconStayAhead({ className = "" }: IconProps) {
  return (
    <svg
      width={34}
      height={34}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
    >
      <path d="M16 4v24M4 16h24M7.5 7.5l17 17M24.5 7.5l-17 17" {...stroke} />
    </svg>
  );
}
