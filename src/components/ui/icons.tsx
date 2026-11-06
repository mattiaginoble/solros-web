/** Icone a tratto, disegnate come segni di matita tecnica (24×24, tratto 1.6). */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconSelect = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3.5 18 10l-5.6 1.6L10 17.4Z" />
  </Svg>
);
export const IconDraw = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20V8l7-4 7 4" />
    <circle cx="4" cy="20" r="1.4" />
    <circle cx="4" cy="8" r="1.4" />
    <circle cx="11" cy="4" r="1.4" />
    <circle cx="18" cy="8" r="1.4" />
    <path d="M18 8v5" strokeDasharray="2 2" />
  </Svg>
);
export const IconRect = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="6" width="16" height="12" />
    <path d="M4 3.5h16M4 2.5v2M20 2.5v2" />
  </Svg>
);
export const IconTemplate = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 4h11v8H3zM14 8h7v12H9v-8" />
    <path d="M9 12h5" />
  </Svg>
);
export const IconDoor = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 20h4M17 20h4" strokeWidth={2.4} />
    <path d="M7 20V8" />
    <path d="M7 8a12 12 0 0 1 10 12" strokeDasharray="2 2" />
  </Svg>
);
export const IconWindow = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12h4M18 12h4" strokeWidth={2.4} />
    <rect x="6" y="10" width="12" height="4" />
    <path d="M6 12h12" />
  </Svg>
);
export const IconPassage = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12h5M17 12h5" strokeWidth={2.4} />
    <path d="M7 9v6M17 9v6" />
    <path d="M9 12h6" strokeDasharray="1.5 2" />
  </Svg>
);
export const IconUndo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 7 4 12l5 5" />
    <path d="M4 12h10a6 6 0 0 1 0 12h-2" transform="translate(0 -6)" />
  </Svg>
);
export const IconRedo = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15 7 5 5-5 5" />
    <path d="M20 12H10a6 6 0 0 0 0 12h2" transform="translate(0 -6)" />
  </Svg>
);
export const IconRotate = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    <path d="M20 4v4h-4" />
  </Svg>
);
export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8" y="8" width="12" height="12" />
    <path d="M16 8V4H4v12h4" />
  </Svg>
);
export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconMinus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);
export const IconFit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    <rect x="8" y="8" width="8" height="8" />
  </Svg>
);
export const IconGrid = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" />
  </Svg>
);
export const IconRuler = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 16 16 3l5 5L8 21Z" />
    <path d="m7 12 2 2M10 9l2 2M13 6l2 2" />
  </Svg>
);
export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 11 12 4l9 7" />
    <path d="M5 10v10h14V10" />
  </Svg>
);
export const IconCube = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9Z" />
    <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
  </Svg>
);
export const IconPlan = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 3h18v18H3zM3 12h8v9M11 3v5M15 12h6" />
  </Svg>
);
export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 15v5h16v-5" />
  </Svg>
);
export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v12M7 11l5 5 5-5" />
    <path d="M4 15v5h16v-5" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12 4.5 4.5L19 7" />
  </Svg>
);
export const IconWarning = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 2 20h20Z" />
    <path d="M12 10v4M12 17v.5" />
  </Svg>
);
export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Svg>
);
export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);
export const IconLayers = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 4 9 5-9 5-9-5Z" />
    <path d="m3 14 9 5 9-5" />
  </Svg>
);
export const IconMerge = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="8" height="12" />
    <rect x="13" y="6" width="8" height="12" />
    <path d="M11 9v6M13 9v6" strokeWidth={2.4} />
  </Svg>
);
export const IconKitchen = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="11" width="18" height="9" />
    <path d="M3 15h18M9 11v9M15 11v9M5 4h14v4H5z" />
  </Svg>
);
export const IconReceipt = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Svg>
);
export const IconShare = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
  </Svg>
);
export const IconChevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);
export const IconWalk = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="13" cy="4.5" r="1.8" />
    <path d="m9 21 2.5-6.5L14 17v4M11.5 14.5 12 9l-4 2v3M12 9l3 2.5 3 .5" />
  </Svg>
);
export const IconOrbit = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="12" cy="12" rx="9.5" ry="4" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M18.5 9 21 8" />
  </Svg>
);
export const IconTop = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="9" width="14" height="11" />
    <path d="M12 2v5M9.5 4.5 12 7l2.5-2.5" />
  </Svg>
);
export const IconImage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" />
    <path d="m3 17 5-5 4 4 3-3 6 6" />
    <circle cx="15.5" cy="8.5" r="1.5" />
  </Svg>
);
export const IconSparkle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </Svg>
);
export const IconHelp = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17v.5" />
  </Svg>
);
