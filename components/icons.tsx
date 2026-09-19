/** Small inline icons. 16px grid, `currentColor`, no icon dependency. */

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function EyeIcon() {
  return (
    <svg {...base}>
      <path d="M1.5 8S3.8 3.5 8 3.5 14.5 8 14.5 8 12.2 12.5 8 12.5 1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="2.1" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg {...base}>
      <path d="M11.2 2.3a1.4 1.4 0 0 1 2 2l-7.4 7.4-2.8.8.8-2.8 7.4-7.4Z" />
      <path d="M9.8 3.7l2.5 2.5" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...base}>
      <path d="M3 8.5l3.2 3.2L13 5" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...base}>
      <path d="M2.8 4.5h10.4M6.2 4.5V3.2h3.6v1.3M4.2 4.5l.6 8.3h6.4l.6-8.3" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg {...base}>
      <circle cx="7.2" cy="7.2" r="4.2" />
      <path d="M10.4 10.4 13.5 13.5" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...base}>
      <path d="M8 3.2v9.6M3.2 8h9.6" />
    </svg>
  );
}
