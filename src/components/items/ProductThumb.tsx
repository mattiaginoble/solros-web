/** Miniatura del prodotto: immagine se disponibile, altrimenti il simbolo in pianta. */
import type { Product } from "@/domain/schema";
import { itemSymbol, symbolFills } from "./symbols";

export function SymbolSvg({ product, className = "" }: { product: Pick<Product, "shape" | "width" | "depth" | "colorHex" | "meta">; className?: string }) {
  const prims = itemSymbol(product.shape, product.width, product.depth, product.meta);
  const fills = symbolFills(product.colorHex);
  const pad = Math.max(product.width, product.depth) * 0.08 + 2;
  const fill = (f?: string) =>
    f === "none" ? "none" : f === "light" ? fills.light : f === "dark" ? fills.dark : fills.base;
  const sw = Math.max(product.width, product.depth) / 70;
  return (
    <svg
      className={className}
      viewBox={`${-product.width / 2 - pad} ${-product.depth / 2 - pad} ${product.width + pad * 2} ${product.depth + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {prims.map((p, i) => {
        if (p.t === "rect")
          return (
            <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r ?? 0} fill={fill(p.fill)} stroke="#23272b" strokeWidth={sw} strokeDasharray={p.dash ? `${sw * 3} ${sw * 3}` : undefined} />
          );
        if (p.t === "circle") return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={fill(p.fill)} stroke="#23272b" strokeWidth={sw} />;
        if (p.t === "ellipse") return <ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={fill(p.fill)} stroke="#23272b" strokeWidth={sw} />;
        return (
          <polyline key={i} points={p.pts.join(" ")} fill="none" stroke="#23272b" strokeWidth={sw} strokeDasharray={p.dash ? `${sw * 3} ${sw * 3}` : undefined} />
        );
      })}
    </svg>
  );
}

export function ProductThumb({ product, className = "" }: { product: Product; className?: string }) {
  if (product.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={product.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className={`object-contain ${className}`} />
    );
  }
  return <SymbolSvg product={product} className={className} />;
}
