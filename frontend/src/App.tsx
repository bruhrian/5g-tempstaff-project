import { useState, useRef, useCallback, useEffect } from "react";

const NODE_TYPES = {
  trigger:   { color: "#FF6D5A", bg: "#FFF0EE", label: "Trigger" },
  action:    { color: "#7B61FF", bg: "#F0EEFF", label: "Action" },
  condition: { color: "#F5A623", bg: "#FFF8EC", label: "Condition" },
  transform: { color: "#36B37E", bg: "#E6F9F2", label: "Transform" },
  output:    { color: "#0052CC", bg: "#E6EEFF", label: "Output" },
};

const NODE_CATALOG = [
  { id: "webhook",    type: "trigger",   name: "Webhook",       desc: "Trigger on HTTP request",  icon: "🔗" },
  { id: "schedule",   type: "trigger",   name: "Schedule",      desc: "Cron-based trigger",        icon: "🕐" },
  { id: "email_trig", type: "trigger",   name: "Email Trigger", desc: "On new email received",     icon: "📧" },
  { id: "http",       type: "action",    name: "HTTP Request",  desc: "Make any HTTP call",        icon: "🌐" },
  { id: "openai",     type: "action",    name: "OpenAI",        desc: "Call GPT models",           icon: "🤖" },
  { id: "slack",      type: "action",    name: "Slack",         desc: "Send Slack messages",       icon: "💬" },
  { id: "gmail",      type: "action",    name: "Gmail",         desc: "Send & read emails",        icon: "📬" },
  { id: "postgres",   type: "action",    name: "Postgres",      desc: "Query your database",       icon: "🗄️" },
  { id: "sheets",     type: "action",    name: "Google Sheets", desc: "Read & write sheets",       icon: "📊" },
  { id: "github",     type: "action",    name: "GitHub",        desc: "Manage repos & issues",     icon: "🐙" },
  { id: "if",         type: "condition", name: "If / Else",     desc: "Branch on condition",       icon: "❓" },
  { id: "switch",     type: "condition", name: "Switch",        desc: "Multiple branches",         icon: "🔀" },
  { id: "set",        type: "transform", name: "Set",           desc: "Set or map fields",         icon: "✏️" },
  { id: "code",       type: "transform", name: "Code",          desc: "Run JavaScript",            icon: "⌨️" },
  { id: "merge",      type: "transform", name: "Merge",         desc: "Merge multiple inputs",     icon: "⊕" },
  { id: "email_send", type: "output",    name: "Send Email",    desc: "Send via SMTP",             icon: "📤" },
  { id: "notion",     type: "output",    name: "Notion",        desc: "Create/update pages",       icon: "📝" },
  { id: "airtable",   type: "output",    name: "Airtable",      desc: "Manage Airtable rows",      icon: "📋" },
];

const INITIAL_NODES = [
  { id: "n1", nodeId: "webhook", x: 80,  y: 200, name: "Webhook",      desc: "Listens for incoming HTTP requests and starts the workflow.", status: "idle", enabled: true  },
  { id: "n2", nodeId: "http",    x: 340, y: 200, name: "HTTP Request",  desc: "Sends an HTTP request to an external API endpoint.",         status: "idle", enabled: true  },
  { id: "n3", nodeId: "if",      x: 600, y: 200, name: "If / Else",     desc: "Routes data based on a true/false condition.",               status: "idle", enabled: true  },
  { id: "n4", nodeId: "slack",   x: 860, y: 100, name: "Slack",         desc: "Posts a message to a Slack channel or user.",               status: "idle", enabled: true  },
  { id: "n5", nodeId: "gmail",   x: 860, y: 330, name: "Gmail",         desc: "Sends or reads emails through a Gmail account.",            status: "idle", enabled: false },
];

const INITIAL_EDGES = [
  { id: "e1", from: "n1", to: "n2", label: "" },
  { id: "e2", from: "n2", to: "n3", label: "" },
  { id: "e3", from: "n3", to: "n4", label: "true" },
  { id: "e4", from: "n3", to: "n5", label: "false" },
];

const NODE_W = 180;
const NODE_H = 76;
// Port radius — bigger for easier grabbing
const PORT_R = 9;

function getCat(nodeId) {
  return NODE_CATALOG.find(c => c.id === nodeId) || NODE_CATALOG[0];
}
function outPort(node) { return { x: node.x + NODE_W, y: node.y + NODE_H / 2 }; }
function inPort(node)  { return { x: node.x,          y: node.y + NODE_H / 2 }; }
function bezier(s, e)  {
  const cx = (s.x + e.x) / 2;
  return `M${s.x},${s.y} C${cx},${s.y} ${cx},${e.y} ${e.x},${e.y}`;
}

// ─── Edge ────────────────────────────────────────────────────────────────────
function EdgePath({ edge, nodes, selected, onClick }) {
  const from = nodes.find(n => n.id === edge.from);
  const to   = nodes.find(n => n.id === edge.to);
  if (!from || !to) return null;

  const s  = outPort(from);
  const e  = inPort(to);
  const d  = bezier(s, e);
  const mx = (s.x + e.x) / 2;
  const my = (s.y + e.y) / 2;
  const disabled = !from.enabled || !to.enabled;

  return (
    <g style={{ cursor: "pointer" }} onClick={ev => { ev.stopPropagation(); onClick(edge.id); }}>
      <path d={d} fill="none" stroke="transparent" strokeWidth={16} />
      <path d={d} fill="none"
        stroke={selected ? "#7B61FF" : disabled ? "#E2E8F0" : "#CBD5E1"}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={disabled ? "6 3" : "none"}
        opacity={disabled ? 0.5 : 1}
      />
      <path d={`M${e.x-8},${e.y-5} L${e.x},${e.y} L${e.x-8},${e.y+5}`}
        fill="none" stroke={selected ? "#7B61FF" : disabled ? "#CBD5E1" : "#94A3B8"} strokeWidth={1.5} />
      {edge.label && (
        <>
          <rect x={mx-22} y={my-11} width={44} height={20} rx={10} fill={selected ? "#EDE9FF" : "#F1F5F9"} />
          <text x={mx} y={my+5} textAnchor="middle" fontSize={10} fill={selected ? "#7B61FF" : "#64748B"} fontFamily="monospace">{edge.label}</text>
        </>
      )}
      {selected && (
        <g transform={`translate(${mx+26},${my-11})`}
          onClick={ev => { ev.stopPropagation(); onClick("__del__" + edge.id); }}
          style={{ cursor: "pointer" }}>
          <circle r={9} fill="#EF4444" />
          <text x={0} y={4} textAnchor="middle" fontSize={11} fill="white" fontWeight={700} style={{ pointerEvents: "none" }}>✕</text>
        </g>
      )}
    </g>
  );
}

// ─── Node ─────────────────────────────────────────────────────────────────────
function WorkflowNode({ node, selected, onSelect, onDrag, onStartEdge }) {
  const cat  = getCat(node.nodeId);
  const type = NODE_TYPES[cat.type];
  const dragRef = useRef(null);
  const didDrag = useRef(false);

  const STATUS_COLOR = { active: "#36B37E", success: "#0052CC", error: "#E53E3E", idle: "#94A3B8" };
  const isDisabled = !node.enabled;

  function handleBodyMouseDown(e) {
    e.stopPropagation();
    dragRef.current = { mx: e.clientX, my: e.clientY, nx: node.x, ny: node.y };
    didDrag.current = false;
    function onMove(ev) {
      const dx = ev.clientX - dragRef.current.mx;
      const dy = ev.clientY - dragRef.current.my;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
      if (didDrag.current) onDrag(node.id, dragRef.current.nx + dx, dragRef.current.ny + dy);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (!didDrag.current) onSelect(node.id);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function handlePortMouseDown(e) {
    e.stopPropagation();
    onStartEdge(node.id, outPort(node));
  }

  const op = outPort(node);
  const ip = inPort(node);

  return (
    <g opacity={isDisabled ? 0.45 : 1}>
      {/* Input port */}
      <circle cx={ip.x} cy={ip.y} r={PORT_R} fill="white" stroke={selected ? type.color : "#CBD5E1"} strokeWidth={2} style={{ pointerEvents: "none" }} />
      <circle cx={ip.x} cy={ip.y} r={4} fill={selected ? type.color : "#CBD5E1"} style={{ pointerEvents: "none" }} />

      {/* Node body */}
      <g transform={`translate(${node.x},${node.y})`} onMouseDown={handleBodyMouseDown} style={{ cursor: "grab" }}>
        <rect width={NODE_W} height={NODE_H} rx={12} fill="white"
          stroke={selected ? type.color : isDisabled ? "#E2E8F0" : "#E2E8F0"}
          strokeWidth={selected ? 2.5 : 1}
          style={{ filter: selected ? `drop-shadow(0 0 10px ${type.color}55)` : "drop-shadow(0 2px 6px rgba(0,0,0,0.07))" }}
        />
        {/* Left color accent bar */}
        <rect x={0} y={0} width={5} height={NODE_H} rx={3} fill={isDisabled ? "#CBD5E1" : type.color} />
        {/* Icon box */}
        <rect x={14} y={14} width={38} height={38} rx={9} fill={isDisabled ? "#F1F5F9" : type.bg} />
        <text x={33} y={38} textAnchor="middle" fontSize={18} style={{ pointerEvents: "none" }}>{cat.icon}</text>
        {/* Name */}
        <text x={62} y={32} fontSize={13} fontWeight={700} fill={isDisabled ? "#94A3B8" : "#1E293B"} fontFamily="'Inter',sans-serif" style={{ pointerEvents: "none" }}>
          {node.name.length > 13 ? node.name.slice(0, 13) + "…" : node.name}
        </text>
        {/* Type label */}
        <text x={62} y={50} fontSize={10} fill={isDisabled ? "#CBD5E1" : "#94A3B8"} fontFamily="'Inter',sans-serif" style={{ pointerEvents: "none" }}>{type.label}</text>
        {/* Status dot */}
        <circle cx={NODE_W - 14} cy={16} r={6} fill={isDisabled ? "#E2E8F0" : (STATUS_COLOR[node.status] || "#94A3B8")} style={{ pointerEvents: "none" }} />
        {/* Disabled badge */}
        {isDisabled && (
          <>
            <rect x={62} y={56} width={42} height={14} rx={7} fill="#F1F5F9" />
            <text x={83} y={66} textAnchor="middle" fontSize={9} fill="#94A3B8" fontWeight={700} style={{ pointerEvents: "none" }}>DISABLED</text>
          </>
        )}
      </g>

      {/* Output port — big, easy to grab */}
      <g onMouseDown={handlePortMouseDown} style={{ cursor: "crosshair" }}>
        {/* Invisible fat hit area */}
        <circle cx={op.x} cy={op.y} r={PORT_R + 6} fill="transparent" />
        {/* Visible ring */}
        <circle cx={op.x} cy={op.y} r={PORT_R} fill="white" stroke={selected ? type.color : "#CBD5E1"} strokeWidth={2} />
        {/* Inner dot / plus */}
        <circle cx={op.x} cy={op.y} r={4} fill={selected ? type.color : "#94A3B8"} />
        <text x={op.x} y={op.y + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="white" style={{ pointerEvents: "none" }}>+</text>
      </g>
    </g>
  );
}

// ─── Node Inspector Panel ─────────────────────────────────────────────────────
function NodePanel({ node, onClose, onUpdate, onDelete }) {
  const cat  = getCat(node.nodeId);
  const type = NODE_TYPES[cat.type];

  return (
    <div style={{ width: 300, background: "#fff", borderLeft: "1px solid #E2E8F0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: node.enabled ? type.bg : "#F8FAFC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>{cat.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1E293B" }}>{node.name}</div>
            <div style={{ fontSize: 10, color: type.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{type.label}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94A3B8", padding: 4 }}>✕</button>
      </div>

      <div style={{ padding: "14px 16px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Enable / Disable toggle — per-node activation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: node.enabled ? "#E6F9F2" : "#FFF5F5", padding: "10px 14px", borderRadius: 10, border: `1px solid ${node.enabled ? "#BBF7D0" : "#FECACA"}` }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: node.enabled ? "#166534" : "#991B1B" }}>
              {node.enabled ? "Node Enabled" : "Node Disabled"}
            </div>
            <div style={{ fontSize: 11, color: node.enabled ? "#4ADE80" : "#F87171", marginTop: 1 }}>
              {node.enabled ? "This node will run in the workflow" : "This node will be skipped"}
            </div>
          </div>
          <div onClick={() => onUpdate(node.id, { enabled: !node.enabled })}
            style={{ width: 44, height: 24, borderRadius: 12, background: node.enabled ? "#22C55E" : "#E2E8F0", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 3, left: node.enabled ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </div>
        </div>

        {/* Node Name */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 1 }}>Node Name</label>
          <input value={node.name} onChange={e => onUpdate(node.id, { name: e.target.value })}
            style={{ width: "100%", marginTop: 6, padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 13, boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}
            onFocus={e => e.target.style.borderColor = "#7B61FF"}
            onBlur={e => e.target.style.borderColor = "#E2E8F0"}
          />
        </div>

        {/* Description — editable */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 1 }}>Description</label>
          <textarea
            value={node.desc || ""}
            onChange={e => onUpdate(node.id, { desc: e.target.value })}
            rows={3}
            placeholder="Add a description for this node…"
            style={{ width: "100%", marginTop: 6, padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 13, boxSizing: "border-box", outline: "none", resize: "vertical", fontFamily: "inherit", color: "#475569", lineHeight: 1.5 }}
            onFocus={e => e.target.style.borderColor = "#7B61FF"}
            onBlur={e => e.target.style.borderColor = "#E2E8F0"}
          />
        </div>

        {/* Webhook URL for trigger nodes */}
        {cat.type === "trigger" && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 1 }}>Webhook URL</label>
            <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
              <input readOnly value="https://hooks.example.com/abc123"
                style={{ flex: 1, padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 11, background: "#F8FAFC", color: "#475569", fontFamily: "monospace" }} />
              <button style={{ padding: "8px 12px", background: "#7B61FF", color: "white", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Copy</button>
            </div>
          </div>
        )}

        {/* Execution status */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 1 }}>Execution Status</label>
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["idle", "active", "success", "error"].map(s => {
              const colors = { idle: ["#F1F5F9","#94A3B8","#E2E8F0"], active: ["#E6F9F2","#166534","#BBF7D0"], success: ["#EFF6FF","#1D4ED8","#BFDBFE"], error: ["#FFF5F5","#991B1B","#FECACA"] };
              const [bg, text, border] = node.status === s ? colors[s] : ["white","#94A3B8","#E2E8F0"];
              return (
                <button key={s} onClick={() => onUpdate(node.id, { status: s })}
                  style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, border: `1px solid ${border}`, background: bg, color: text, cursor: "pointer", textTransform: "capitalize", fontWeight: node.status === s ? 700 : 400 }}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Last execution info */}
        <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "12px 14px", border: "1px solid #E2E8F0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Last Execution</div>
          <div style={{ fontSize: 12, color: "#475569" }}>⏱ Duration: <strong>142ms</strong></div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>📦 Items processed: <strong>3</strong></div>
          <div style={{ fontSize: 12, color: "#36B37E", marginTop: 4 }}>✓ Completed successfully</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0" }}>
        <button onClick={() => onDelete(node.id)}
          style={{ width: "100%", padding: "9px", background: "#FFF5F5", color: "#E53E3E", border: "1px solid #FECACA", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          🗑 Delete Node
        </button>
      </div>
    </div>
  );
}

// ─── Add Node Panel ───────────────────────────────────────────────────────────
function AddNodePanel({ onAdd, onClose }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const filtered = NODE_CATALOG.filter(n =>
    (tab === "all" || n.type === tab) &&
    (n.name.toLowerCase().includes(search.toLowerCase()) || n.desc.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div style={{ width: 280, background: "#fff", borderLeft: "1px solid #E2E8F0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#1E293B" }}>Add Node</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94A3B8" }}>✕</button>
      </div>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0" }}>
        <input placeholder="Search nodes…" value={search} onChange={e => setSearch(e.target.value)} autoFocus
          style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, boxSizing: "border-box", background: "#F8FAFC", outline: "none", fontFamily: "inherit" }}
          onFocus={e => e.target.style.borderColor = "#7B61FF"}
          onBlur={e => e.target.style.borderColor = "#E2E8F0"}
        />
      </div>
      <div style={{ display: "flex", gap: 4, padding: "7px 10px", borderBottom: "1px solid #E2E8F0", flexWrap: "wrap" }}>
        {["all","trigger","action","condition","transform","output"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "3px 9px", borderRadius: 20, fontSize: 10, border: "1px solid", borderColor: tab === t ? "#7B61FF" : "#E2E8F0", background: tab === t ? "#EDE9FF" : "white", color: tab === t ? "#7B61FF" : "#64748B", cursor: "pointer", textTransform: "capitalize", fontWeight: tab === t ? 700 : 400 }}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>
        {filtered.map(cat => {
          const type = NODE_TYPES[cat.type];
          return (
            <button key={cat.id} onClick={() => { onAdd(cat.id); onClose(); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", border: "1px solid transparent", borderRadius: 8, background: "none", cursor: "pointer", textAlign: "left", marginBottom: 2 }}
              onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{cat.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{cat.name}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.desc}</div>
              </div>
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 12, background: type.bg, color: type.color, fontWeight: 700, flexShrink: 0, textTransform: "capitalize" }}>{cat.type}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Edge Panel ───────────────────────────────────────────────────────────────
function EdgePanel({ edge, onClose, onUpdate, onDelete }) {
  return (
    <div style={{ width: 260, background: "#fff", borderLeft: "1px solid #E2E8F0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#1E293B" }}>Connection</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94A3B8" }}>✕</button>
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 1 }}>Label</label>
          <input value={edge.label || ""} onChange={e => onUpdate(edge.id, { label: e.target.value })}
            placeholder="e.g. true, false, success…"
            style={{ width: "100%", marginTop: 6, padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 13, boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}
            onFocus={e => e.target.style.borderColor = "#7B61FF"}
            onBlur={e => e.target.style.borderColor = "#E2E8F0"}
          />
        </div>
        <div style={{ fontSize: 12, color: "#94A3B8", background: "#F8FAFC", padding: "10px 12px", borderRadius: 8, border: "1px solid #E2E8F0", lineHeight: 1.6 }}>
          Tip: click the <strong style={{ color: "#EF4444" }}>✕</strong> on the line to delete quickly.
        </div>
        <button onClick={() => onDelete(edge.id)}
          style={{ padding: 9, background: "#FFF5F5", color: "#E53E3E", border: "1px solid #FECACA", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          🗑 Delete Connection
        </button>
      </div>
    </div>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
function ContextMenu({ x, y, onAddNode, onClose }) {
  useEffect(() => {
    function onDown() { onClose(); }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div onMouseDown={e => e.stopPropagation()}
      style={{ position: "fixed", top: y, left: x, background: "white", borderRadius: 10, border: "1px solid #E2E8F0", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: "6px", zIndex: 9999, minWidth: 180 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, padding: "4px 10px 6px" }}>Canvas</div>
      <button
        onClick={() => { onAddNode(); onClose(); }}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: "none", borderRadius: 7, background: "none", cursor: "pointer", fontSize: 13, color: "#1E293B", textAlign: "left", fontWeight: 600 }}
        onMouseEnter={e => e.currentTarget.style.background = "#F0EEFF"}
        onMouseLeave={e => e.currentTarget.style.background = "none"}>
        <span style={{ fontSize: 16 }}>➕</span> Add Node
      </button>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [nodes,        setNodes]        = useState(INITIAL_NODES);
  const [edges,        setEdges]        = useState(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [rightPanel,   setRightPanel]   = useState(null); // 'node'|'edge'|'add'
  const [zoom,         setZoom]         = useState(1);
  const [pan,          setPan]          = useState({ x: 60, y: 30 });
  const [isActive,     setIsActive]     = useState(true);
  const [running,      setRunning]      = useState(false);
  const [showGrid,     setShowGrid]     = useState(true);
  const [pendingEdge,  setPendingEdge]  = useState(null);
  const [ctxMenu,      setCtxMenu]      = useState(null); // { x, y }

  const svgRef = useRef(null);
  const panRef = useRef(null);

  // Keyboard delete
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) return;
      if (selectedNode) deleteNode(selectedNode);
      else if (selectedEdge) deleteEdge(selectedEdge);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNode, selectedEdge]);

  const handleNodeDrag = useCallback((id, x, y) => {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, x, y } : n));
  }, []);

  const handleNodeSelect = useCallback((id) => {
    setSelectedNode(id);
    setSelectedEdge(null);
    setRightPanel("node");
  }, []);

  function deleteNode(id) {
    setNodes(ns => ns.filter(n => n.id !== id));
    setEdges(es => es.filter(e => e.from !== id && e.to !== id));
    setSelectedNode(null);
    setRightPanel(null);
  }

  function updateNode(id, updates) {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, ...updates } : n));
  }

  function addNode(nodeId, spawnX, spawnY) {
    const id = `n${Date.now()}`;
    let x, y;
    if (spawnX != null) {
      // Spawned from right-click position (already in canvas coords)
      x = spawnX - NODE_W / 2;
      y = spawnY - NODE_H / 2;
    } else {
      const rect = svgRef.current?.getBoundingClientRect() || { width: 800, height: 600 };
      x = (rect.width  / 2 - pan.x) / zoom - NODE_W / 2 + (Math.random() * 60 - 30);
      y = (rect.height / 2 - pan.y) / zoom - NODE_H / 2 + (Math.random() * 60 - 30);
    }
    const cat = getCat(nodeId);
    setNodes(ns => [...ns, { id, nodeId, x, y, name: cat.name, desc: cat.desc, status: "idle", enabled: true }]);
    setSelectedNode(id);
    setRightPanel("node");
  }

  const handleEdgeClick = useCallback((raw) => {
    if (raw.startsWith("__del__")) {
      deleteEdge(raw.replace("__del__", ""));
    } else {
      setSelectedEdge(raw);
      setSelectedNode(null);
      setRightPanel("edge");
    }
  }, []);

  function deleteEdge(id) {
    setEdges(es => es.filter(e => e.id !== id));
    setSelectedEdge(null);
    setRightPanel(null);
  }

  function updateEdge(id, updates) {
    setEdges(es => es.map(e => e.id === id ? { ...e, ...updates } : e));
  }

  function handleStartEdge(fromId, fromPort) {
    setPendingEdge({ fromId, from: fromPort, mouse: fromPort });
    function onMove(ev) {
      const rect = svgRef.current.getBoundingClientRect();
      setPendingEdge(pe => pe ? { ...pe, mouse: {
        x: (ev.clientX - rect.left - pan.x) / zoom,
        y: (ev.clientY - rect.top  - pan.y) / zoom,
      }} : null);
    }
    function onUp(ev) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const rect = svgRef.current.getBoundingClientRect();
      const mx = (ev.clientX - rect.left - pan.x) / zoom;
      const my = (ev.clientY - rect.top  - pan.y) / zoom;
      setNodes(cur => {
        const target = cur.find(n => n.id !== fromId && mx >= n.x - 20 && mx <= n.x + NODE_W + 20 && my >= n.y - 10 && my <= n.y + NODE_H + 10);
        if (target) {
          setEdges(es => {
            if (es.some(e => e.from === fromId && e.to === target.id)) return es;
            return [...es, { id: `e${Date.now()}`, from: fromId, to: target.id, label: "" }];
          });
        }
        return cur;
      });
      setPendingEdge(null);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function handleCanvasMouseDown(e) {
    if (e.target !== svgRef.current && !e.target.hasAttribute("data-canvas")) return;
    setSelectedNode(null);
    setSelectedEdge(null);
    setRightPanel(null);
    panRef.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
    function onMove(ev) {
      if (!panRef.current) return;
      setPan({ x: panRef.current.px + ev.clientX - panRef.current.mx, y: panRef.current.py + ev.clientY - panRef.current.my });
    }
    function onUp() { panRef.current = null; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // Right-click on canvas → context menu
  function handleContextMenu(e) {
    e.preventDefault();
    // Only fire on the canvas background, not on nodes/edges
    if (e.target !== svgRef.current && !e.target.hasAttribute("data-canvas")) return;
    setCtxMenu({ x: e.clientX, y: e.clientY, canvasX: (e.clientX - (svgRef.current?.getBoundingClientRect().left || 0) - pan.x) / zoom, canvasY: (e.clientY - (svgRef.current?.getBoundingClientRect().top  || 0) - pan.y) / zoom });
  }

  function handleWheel(e) {
    e.preventDefault();
    setZoom(z => Math.max(0.25, Math.min(2, z * (1 - e.deltaY * 0.001))));
  }

  const selNode = nodes.find(n => n.id === selectedNode);
  const selEdge = edges.find(e => e.id === selectedEdge);
  const panelWidth = rightPanel ? (rightPanel === "node" ? 300 : rightPanel === "add" ? 280 : 260) : 0;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Inter',-apple-system,sans-serif", overflow: "hidden", background: "#F8FAFC" }}>

      {/* Slim sidebar */}
      <div style={{ width: 52, background: "#0F172A", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, gap: 6, flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, background: "#FF6D5A", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 8 }}>⚡</div>
        {[{ icon: "◫", tip: "Editor", on: true }, { icon: "▶", tip: "Executions", on: false }, { icon: "🔑", tip: "Credentials", on: false }, { icon: "⚙", tip: "Settings", on: false }].map(item => (
          <button key={item.tip} title={item.tip}
            style={{ width: 36, height: 36, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16, background: item.on ? "rgba(123,97,255,0.3)" : "transparent", color: item.on ? "#A78BFA" : "#475569", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {item.icon}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#7B61FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "white", fontWeight: 700, marginBottom: 12 }}>JD</div>
      </div>

      {/* Main editor area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Toolbar */}
        <div style={{ height: 52, background: "white", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 8, padding: "0 16px", flexShrink: 0 }}>
          <input defaultValue="My Workflow"
            style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", border: "1px solid transparent", borderRadius: 6, padding: "5px 8px", background: "transparent", outline: "none", fontFamily: "inherit" }}
            onFocus={e => e.target.style.borderColor = "#7B61FF"}
            onBlur={e => e.target.style.borderColor = "transparent"} />
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "#E6F9F2", color: "#36B37E", fontWeight: 700 }}>Saved</span>
          <div style={{ flex: 1 }} />

          <button onClick={() => setShowGrid(g => !g)}
            style={{ padding: "6px 10px", border: "1px solid #E2E8F0", borderRadius: 6, background: showGrid ? "#EDE9FF" : "white", color: showGrid ? "#7B61FF" : "#94A3B8", cursor: "pointer", fontSize: 12 }}>Grid</button>
          <button onClick={() => setZoom(z => Math.min(2, +(z+0.1).toFixed(1)))}
            style={{ padding: "6px 11px", border: "1px solid #E2E8F0", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14 }}>+</button>
          <span style={{ fontSize: 12, color: "#64748B", minWidth: 38, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.25, +(z-0.1).toFixed(1)))}
            style={{ padding: "6px 11px", border: "1px solid #E2E8F0", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14 }}>−</button>
          <button onClick={() => { setZoom(1); setPan({ x: 60, y: 30 }); }}
            style={{ padding: "6px 10px", border: "1px solid #E2E8F0", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 12, color: "#64748B" }}>Reset</button>
          <div style={{ width: 1, height: 28, background: "#E2E8F0" }} />

          <button onClick={() => setRightPanel(rp => rp === "add" ? null : "add")}
            style={{ padding: "7px 14px", border: "1px solid #E2E8F0", borderRadius: 6, background: rightPanel === "add" ? "#EDE9FF" : "white", color: rightPanel === "add" ? "#7B61FF" : "#475569", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            + Add Node
          </button>

          {/* Global workflow active toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F8FAFC", padding: "5px 10px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>Workflow</span>
            <div onClick={() => setIsActive(a => !a)}
              style={{ width: 40, height: 22, borderRadius: 11, background: isActive ? "#7B61FF" : "#E2E8F0", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 3, left: isActive ? 20 : 3, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
            </div>
          </div>

          <button onClick={() => { setRunning(true); setTimeout(() => setRunning(false), 2200); }} disabled={running}
            style={{ padding: "7px 18px", background: running ? "#94A3B8" : "#FF6D5A", color: "white", border: "none", borderRadius: 8, cursor: running ? "default" : "pointer", fontSize: 13, fontWeight: 700 }}>
            {running ? "⟳ Running…" : "▶ Execute"}
          </button>
        </div>

        {/* Canvas + right panels */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <svg ref={svgRef} width="100%" height="100%"
              onMouseDown={handleCanvasMouseDown}
              onWheel={handleWheel}
              onContextMenu={handleContextMenu}
              style={{ display: "block", userSelect: "none", cursor: pendingEdge ? "crosshair" : "default" }}>
              {showGrid && (
                <defs>
                  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#E2E8F0" strokeWidth="0.5" />
                  </pattern>
                </defs>
              )}
              {showGrid && <rect data-canvas="1" width="100%" height="100%" fill="url(#grid)" />}

              <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                {edges.map(edge => (
                  <EdgePath key={edge.id} edge={edge} nodes={nodes} selected={selectedEdge === edge.id} onClick={handleEdgeClick} />
                ))}
                {pendingEdge && (
                  <path d={bezier(pendingEdge.from, pendingEdge.mouse)} fill="none" stroke="#7B61FF" strokeWidth={2} strokeDasharray="7 4" />
                )}
                {nodes.map(node => (
                  <WorkflowNode key={node.id} node={node} selected={selectedNode === node.id}
                    onSelect={handleNodeSelect} onDrag={handleNodeDrag} onStartEdge={handleStartEdge} />
                ))}
              </g>
            </svg>

            {/* Status bar */}
            <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 8, pointerEvents: "none" }}>
              <div style={{ background: "white", borderRadius: 8, padding: "5px 12px", border: "1px solid #E2E8F0", fontSize: 12, color: "#64748B" }}>
                {nodes.length} nodes · {edges.length} connections · {nodes.filter(n => n.enabled).length} active
              </div>
              {running && (
                <div style={{ background: "#EDE9FF", borderRadius: 8, padding: "5px 12px", border: "1px solid #C4B5FD", fontSize: 12, color: "#7B61FF", fontWeight: 700 }}>
                  ⟳ Executing…
                </div>
              )}
            </div>

            {/* Hint bar */}
            <div style={{ position: "absolute", bottom: 14, right: panelWidth + 14, background: "white", borderRadius: 8, padding: "5px 12px", border: "1px solid #E2E8F0", fontSize: 11, color: "#94A3B8", pointerEvents: "none", transition: "right 0.15s" }}>
              Drag <strong style={{ color: "#475569" }}>+</strong> port to connect · Right-click canvas to add · <kbd style={{ background: "#F1F5F9", padding: "1px 5px", borderRadius: 4, fontSize: 10 }}>Del</kbd> removes selected
            </div>

            {nodes.length === 0 && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ textAlign: "center", color: "#94A3B8" }}>
                  <div style={{ fontSize: 52, marginBottom: 10 }}>◫</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#64748B" }}>Canvas is empty</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Right-click or use + Add Node to start</div>
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          {rightPanel === "node" && selNode && (
            <NodePanel node={selNode} onClose={() => setRightPanel(null)} onUpdate={updateNode} onDelete={deleteNode} />
          )}
          {rightPanel === "edge" && selEdge && (
            <EdgePanel edge={selEdge} onClose={() => setRightPanel(null)} onUpdate={updateEdge} onDelete={deleteEdge} />
          )}
          {rightPanel === "add" && (
            <AddNodePanel onAdd={(nodeId) => addNode(nodeId)} onClose={() => setRightPanel(null)} />
          )}
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          onAddNode={() => { setRightPanel("add"); }}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}