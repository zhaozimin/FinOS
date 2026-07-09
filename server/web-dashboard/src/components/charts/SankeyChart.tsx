import type { EChartsOption } from "echarts";
import { EChart } from "./EChart";
import { getPalette, getSeriesPalette } from "./theme";
import { useThemeStore } from "../../store/theme";
import type { SankeyLink, SankeyNode } from "../../types";

export type SankeySelection =
  | { kind: "node"; name: string }
  | { kind: "edge"; source: string; target: string };

interface Props {
  nodes: SankeyNode[];
  links: SankeyLink[];
  height?: number;
  onSelect?: (selection: SankeySelection) => void;
}

export function SankeyChart({ nodes, links, height = 420, onSelect }: Props) {
  const resolved = useThemeStore((s) => s.resolved);
  const paletteId = useThemeStore((s) => s.palette);
  const isDark = resolved === "dark";
  const palette = getPalette(isDark, paletteId);
  const series = getSeriesPalette(isDark, paletteId);

  if (!nodes.length || !links.length) {
    return <div className="empty-state">本期暂无资金流向</div>;
  }

  const targetNames = new Set(links.map((link) => link.target));
  const sourceNames = new Set(links.map((link) => link.source));
  const styledNodes = nodes.map((node, index) => {
    const labelPosition = !targetNames.has(node.name) && sourceNames.has(node.name)
      ? ("left" as const)
      : ("right" as const);
    return {
      name: node.name,
      itemStyle: {
        color: node.itemStyle?.color || series[index % series.length],
        borderColor: palette.bg,
        borderWidth: 1,
      },
      label: {
        position: labelPosition,
      },
    };
  });

  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: ((params: any) => {
        if (params.dataType === "edge") {
          const value = Number(params.data?.value || 0);
          return `${params.data?.source} → ${params.data?.target}<br/><b>¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}</b>`;
        }
        return params.data?.name || params.name || "";
      }) as any,
    },
    series: [
      {
        type: "sankey",
        data: styledNodes,
        links: links.map((link) => ({ source: link.source, target: link.target, value: link.value })),
        nodeAlign: "justify",
        nodeWidth: 16,
        nodeGap: 14,
        left: "10%",
        right: "10%",
        top: 22,
        bottom: 22,
        emphasis: { focus: "adjacency" },
        lineStyle: {
          color: "gradient",
          curveness: 0.5,
          opacity: isDark ? 0.55 : 0.45,
        },
        label: {
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          color: palette.body,
        },
        cursor: "pointer",
      },
    ],
  };

  return (
    <EChart
      option={option}
      style={{ width: "100%", height }}
      onChartClick={(params) => {
        if (!onSelect) return;
        // sankey 连线 dataType === "edge"
        if (params.dataType === "edge") {
          const data = params.data as { source?: string; target?: string } | undefined;
          const source = String(data?.source || "");
          const target = String(data?.target || "");
          if (source && target) onSelect({ kind: "edge", source, target });
          return;
        }
        // 其余（node 矩形 + 标签）按节点处理；标签点击有时不带 dataType
        const data = params.data as { name?: string } | undefined;
        const name = String(data?.name || params.name || "");
        if (name) onSelect({ kind: "node", name });
      }}
    />
  );
}
