import { useCallback, useEffect, useState } from "react";
import styles from './Mermaid.module.scss';
import { toast } from "../../services/toast-service";
import { generateElementId } from "../../utils";
import IconButton from "../icon/IconButton";

interface MermaidProps {
  chart: string;
}

const tidySyntax = (src: string): string => {
  let s = src;

  s = s.replace(/\\n/gi, '\n');
  
  s = s.replace(/([A-Za-z_][\w-]*\s*\{[^}]*?)\(([^)]*?)\)([^}]*?\})/g, (_, before, content, after) => {
    return `${before} ${content} ${after}`;
  });
  
  s = s.replace(/([A-Za-z_][\w-]*\s*\[[^\]]*?)\(([^)]*?)\)([^\]]*?\])/g, (_, before, content, after) => {
    return `${before} ${content} ${after}`;
  });
  
  s = s.replace(/([A-Za-z_][\w-]*\s*\{[^}]*?)\[([^\]]*?)\]([^}]*?\})/g, (_, before, content, after) => {
    return `${before} ${content} ${after}`;
  });
  
  s = s.replace(/([A-Za-z_][\w-]*\s*\[[^\]]*?)\{([^}]*?)\}([^\]]*?\])/g, (_, before, content, after) => {
    return `${before} ${content} ${after}`;
  });
  
  s = s.replace(/([A-Za-z_][\w-]+(?:,[A-Za-z_][\w-]+)+)\s+class\s+([a-zA-Z_][a-zA-Z0-9_-]*)/g, (_, nodes, className) => {
    return nodes.split(',').map((node: string) => `${node.trim()} class ${className}`).join('\n    ');
  });
  
  s = s.replace(/([A-Za-z_][\w-]*)\s+class\s+([a-zA-Z_][a-zA-Z0-9_-]*)/g, '$1:::$2');
  
  s = s.replace(/style\s+([A-Za-z_][\w-]*)\s+fill:([^,\s]+)(?:,stroke:([^,\s]+))?(?:,stroke-width:(\d+px))?/g, (_, node, fill, stroke, strokeWidth) => {
    const styleName = `style_${node}`;
    let classDefLine = `classDef ${styleName} fill:${fill}`;
    if (stroke) classDefLine += `,stroke:${stroke}`;
    if (strokeWidth) classDefLine += `,stroke-width:${strokeWidth}`;
    return `${classDefLine}\n    ${node}:::${styleName}`;
  });
  
  return s;
}

export default function Mermaid({ chart }: MermaidProps) {

  const [svg, setSvg] = useState<string>("");

  

  const downloadPng = useCallback(() => {
    if (!svg) return;

    // Parse SVG to extract dimensions
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;
    
    let width = 800;
    let height = 600;
    
    // Try to get dimensions from viewBox or width/height attributes
    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
      const [, , w, h] = viewBox.split(/\s+|,/).map(Number);
      if (w && h) {
        width = w;
        height = h;
      }
    } else {
      const widthAttr = svgElement.getAttribute('width');
      const heightAttr = svgElement.getAttribute('height');
      if (widthAttr && heightAttr) {
        width = parseFloat(widthAttr) || width;
        height = parseFloat(heightAttr) || height;
      }
    }
    
    // Use scale factor for higher resolution (2x for better quality)
    const scale = 2;
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;

    const img = new Image();
    // Use data URL instead of blob URL to avoid tainted canvas
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Scale the context for higher resolution
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'mermaid.png';
            a.click();
            URL.revokeObjectURL(downloadUrl);
          }
        }, 'image/png');
      }
    };

    img.onerror = () => {
      toast.error("Failed to download PNG image");
    };

    img.src = svgDataUrl;
  }, [svg]);

  useEffect(() => {
    let isMounted = true;

    import("mermaid")
      .then((mermaidModule) => {
        const mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "default",
        });

        const id = generateElementId();
        return mermaid.render(id, tidySyntax(chart));
      })
      .then(({ svg }) => {
        if (isMounted) {
          setSvg(svg);
        }
      })
      .catch(() => {
        if (isMounted) {
          // do nothing
        }
      });

    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (!svg) {
    return <pre>{chart}</pre>;
  }

  return (
    <div className={styles.mermaid}>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <IconButton icon="download" onClick={downloadPng} />
    </div>
  )
}