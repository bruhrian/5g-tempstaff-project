import { useState, useRef, useCallback, useEffect } from "react";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";

// ─── Auth state ───────────────────────────────────────────────────────────────
type Page = "login" | "register" | "app";

function useAuth() {
  const [page, setPage] = useState<Page>("login");
  const [checking, setChecking] = useState(true);

  // On first load, check if there's already a valid session
  useEffect(() => {
    fetch("http://127.0.0.1:8000/users/me", { credentials: "include" })
      .then(res => {
        if (res.ok) setPage("app");
        else setPage("login");
      })
      .catch(() => setPage("login"))
      .finally(() => setChecking(false));
  }, []);

  return { page, setPage, checking };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function App() {
  const { page, setPage, checking } = useAuth();

  if (checking) {
    return (
      <div style={{
        minHeight: "100vh", background: "#F8FAFC",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        <div style={{ color: "#94A3B8", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (page === "login") {
    return (
      <LoginPage
        onLoginSuccess={() => setPage("app")}
        onGoToRegister={() => setPage("register")}
      />
    );
  }

  if (page === "register") {
    return (
      <RegisterPage
        onGoToLogin={() => setPage("login")}
      />
    );
  }

  return <WorkflowApp onLogout={() => setPage("login")} />;
}

// ─── The rest of your existing app, wrapped in WorkflowApp ───────────────────
// Pass onLogout down so the sidebar avatar button can log the user out.
function WorkflowApp({ onLogout }: { onLogout: () => void }) {

  // ── All your existing state & logic below (unchanged) ────────────────────

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

  return (
    <g opacity={isDisabled ? 0.55 : 1}>
      <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={10}
        fill="white"
        stroke={selected ? "#7B61FF" : "#E2E8F0"}
        strokeWidth={selected ? 2 : 1}
        style={{ filter: selected ? "drop-shadow(0 0 8px rgba(123,97,255,0.25))" : "drop-shadow(0 1px 3px rgba(0,0,0,0.08))", cursor: "grab" }}
        onMouseDown={handleBodyMouseDown}
      />
      <rect x={node.x} y={node.y} width={4} height={NODE_H} rx={2} fill={type.color} style={{ pointerEvents: "none" }} />
      <circle cx={node.x} cy={node.y + NODE_H / 2} r={PORT_R}
        fill="white" stroke={type.color} strokeWidth={2}
        style={{ cursor: "default", pointerEvents: "none" }}
      />
      <rect x={node.x + 14} y={node.y + 10} width={28} height={28} rx={7} fill={type.bg} style={{ pointerEvents: "none" }} />
      <text x={node.x + 28} y={node.y + 29} textAnchor="middle" fontSize={14} style={{ pointerEvents: "none" }}>{cat.icon}</text>
      <text x={node.x + 52} y={node.y + 24} fontSize={12} fontWeight={700} fill={isDisabled ? "#94A3B8" : "#1E293B"} fontFamily="inherit" style={{ pointerEvents: "none" }}>{node.name}</text>
      <text x={node.x + 52} y={node.y + 38} fontSize={10} fill="#94A3B8" fontFamily="inherit" style={{ pointerEvents: "none" }}>
        {cat.type.charAt(0).toUpperCase() + cat.type.slice(1)}
        {isDisabled ? " · DISABLED" : ""}
      </text>
      <circle cx={node.x + NODE_W - 14} cy={node.y + 14} r={4} fill={STATUS_COLOR[node.status] || "#94A3B8"} style={{ pointerEvents: "none" }} />
      <circle cx={node.x + NODE_W} cy={node.y + NODE_H / 2} r={PORT_R}
        fill="white" stroke={type.color} strokeWidth={2}
        style={{ cursor: "crosshair" }}
        onMouseDown={handlePortMouseDown}
      />
    </g>
  );
}

function NodePanel({ node, onClose, onUpdate, onDelete }) {
  const cat = getCat(node.nodeId);
  const type = NODE_TYPES[cat.type];
  return (
    <div style={{ width: 280, background: "white", borderLeft: "1px solid #E2E8F0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: type.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{cat.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{node.name}</div>
          <div style={{ fontSize: 11, color: type.color, fontWeight: 600 }}>{type.label}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94A3B8" }}>✕</button>
      </div>
      <div style={{ padding: 16, flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>DESCRIPTION</div>
          <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{node.desc}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>NAME</div>
          <input defaultValue={node.name}
            onBlur={e => onUpdate(node.id, { name: e.target.value })}
            style={{ width: "100%", padding: "7px 10px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            onFocus={e => e.target.style.borderColor = "#7B61FF"}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Enabled</div>
          <div onClick={() => onUpdate(node.id, { enabled: !node.enabled })}
            style={{ width: 36, height: 20, borderRadius: 10, background: node.enabled ? "#7B61FF" : "#E2E8F0", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: 2, left: node.enabled ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
          </div>
        </div>
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0" }}>
        <button onClick={() => onDelete(node.id)}
          style={{ width: "100%", padding: "8px", background: "#FFF0EE", color: "#EF4444", border: "1px solid #FECACA", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
          Delete Node
        </button>
      </div>
    </div>
  );
}

function EdgePanel({ edge, onClose, onUpdate, onDelete }) {
  return (
    <div style={{ width: 280, background: "white", borderLeft: "1px solid #E2E8F0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#1E293B" }}>Connection</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94A3B8" }}>✕</button>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>LABEL</div>
          <input defaultValue={edge.label}
            onBlur={e => onUpdate(edge.id, { label: e.target.value })}
            placeholder="true / false / …"
            style={{ width: "100%", padding: "7px 10px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            onFocus={e => e.target.style.borderColor = "#7B61FF"}
          />
        </div>
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0", marginTop: "auto" }}>
        <button onClick={() => onDelete(edge.id)}
          style={{ width: "100%", padding: "8px", background: "#FFF0EE", color: "#EF4444", border: "1px solid #FECACA", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
          Delete Connection
        </button>
      </div>
    </div>
  );
}

function AddNodePanel({ onAdd, onClose }) {
  const [filter, setFilter] = useState("");
  const filtered = NODE_CATALOG.filter(n =>
    n.name.toLowerCase().includes(filter.toLowerCase()) ||
    n.type.toLowerCase().includes(filter.toLowerCase())
  );
  const grouped = ["trigger","action","condition","transform","output"].map(t => ({
    type: t, items: filtered.filter(n => n.type === t)
  })).filter(g => g.items.length > 0);

  return (
    <div style={{ width: 280, background: "white", borderLeft: "1px solid #E2E8F0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#1E293B" }}>Add Node</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94A3B8" }}>✕</button>
      </div>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #E2E8F0" }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search nodes…"
          style={{ width: "100%", padding: "7px 10px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          onFocus={e => e.target.style.borderColor = "#7B61FF"}
          onBlur={e => e.target.style.borderColor = "#E2E8F0"}
        />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {grouped.map(group => (
          <div key={group.type}>
            <div style={{ padding: "6px 16px 4px", fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.8px" }}>
              {NODE_TYPES[group.type].label.toUpperCase()}
            </div>
            {group.items.map(item => (
              <button key={item.id} onClick={() => onAdd(item.id)}
                style={{ width: "100%", padding: "8px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: NODE_TYPES[item.type].bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{item.desc}</div>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ContextMenu({ x, y, onAddNode, onClose }) {
  useEffect(() => {
    const h = () => onClose();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div style={{ position: "fixed", top: y, left: x, background: "white", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 1000, minWidth: 160, overflow: "hidden" }}>
      <button onClick={onAddNode}
        style={{ width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 12, textAlign: "left", color: "#1E293B", display: "flex", alignItems: "center", gap: 8 }}
        onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
        onMouseLeave={e => (e.currentTarget.style.background = "none")}>
        <span>＋</span> Add Node
      </button>
    </div>
  );
}

  // ── State ─────────────────────────────────────────────────────────────────
  const [nodes, setNodes]           = useState(INITIAL_NODES);
  const [edges, setEdges]           = useState(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [rightPanel, setRightPanel] = useState(null);
  const [zoom, setZoom]             = useState(1);
  const [pan, setPan]               = useState({ x: 60, y: 30 });
  const [showGrid, setShowGrid]     = useState(true);
  const [isActive, setIsActive]     = useState(true);
  const [running, setRunning]       = useState(false);
  const [pendingEdge, setPendingEdge] = useState(null);
  const [ctxMenu, setCtxMenu]       = useState(null);
  const svgRef                      = useRef(null);

  const panRef  = useRef(null);
  const panelWidth = rightPanel ? 280 : 0;

  const selNode = nodes.find(n => n.id === selectedNode);
  const selEdge = edges.find(e => e.id === selectedEdge);

  function handleNodeSelect(id) {
    setSelectedNode(id); setSelectedEdge(null); setRightPanel("node");
  }
  function handleNodeDrag(id, x, y) {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, x, y } : n));
  }
  function updateNode(id, patch) {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n));
  }
  function deleteNode(id) {
    setNodes(ns => ns.filter(n => n.id !== id));
    setEdges(es => es.filter(e => e.from !== id && e.to !== id));
    setSelectedNode(null); setRightPanel(null);
  }
  function handleEdgeClick(id) {
    if (id.startsWith("__del__")) {
      const eid = id.slice(7);
      setEdges(es => es.filter(e => e.id !== eid));
      setSelectedEdge(null); setRightPanel(null);
    } else {
      setSelectedEdge(id); setSelectedNode(null); setRightPanel("edge");
    }
  }
  function updateEdge(id, patch) {
    setEdges(es => es.map(e => e.id === id ? { ...e, ...patch } : e));
  }
  function deleteEdge(id) {
    setEdges(es => es.filter(e => e.id !== id));
    setSelectedEdge(null); setRightPanel(null);
  }
  function addNode(nodeId) {
    const cat = NODE_CATALOG.find(c => c.id === nodeId);
    const id = "n" + Date.now();
    setNodes(ns => [...ns, { id, nodeId, x: 200, y: 200, name: cat.name, desc: cat.desc, status: "idle", enabled: true }]);
    setRightPanel(null);
  }

  const handleStartEdge = useCallback((fromId, fromPt) => {
    setPendingEdge({ fromId, from: fromPt, mouse: fromPt });
    function onMove(e) {
      const svg = svgRef.current; if (!svg) return;
      const r = svg.getBoundingClientRect();
      const mx = (e.clientX - r.left - pan.x) / zoom;
      const my = (e.clientY - r.top  - pan.y) / zoom;
      setPendingEdge(pe => pe ? { ...pe, mouse: { x: mx, y: my } } : null);
    }
    function onUp(e) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const svg = svgRef.current; if (!svg) { setPendingEdge(null); return; }
      const r = svg.getBoundingClientRect();
      const mx = (e.clientX - r.left - pan.x) / zoom;
      const my = (e.clientY - r.top  - pan.y) / zoom;
      setNodes(ns => {
        const target = ns.find(n => {
          const ip = inPort(n);
          return Math.hypot(ip.x - mx, ip.y - my) < 18;
        });
        if (target && target.id !== fromId) {
          const newEdge = { id: "e" + Date.now(), from: fromId, to: target.id, label: "" };
          setEdges(es => [...es, newEdge]);
        }
        return ns;
      });
      setPendingEdge(null);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [pan, zoom]);

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.dataset.canvas !== "1" && e.target.tagName !== "svg") return;
    setSelectedNode(null); setSelectedEdge(null); setRightPanel(null);
    const start = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    panRef.current = start;
    function onMove(ev) {
      if (!panRef.current) return;
      setPan({ x: start.px + ev.clientX - start.x, y: start.py + ev.clientY - start.y });
    }
    function onUp() {
      panRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [pan]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(2, Math.max(0.25, +(z + delta).toFixed(1))));
  }, []);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  async function handleLogout() {
    await fetch("http://127.0.0.1:8000/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    onLogout();
  }

  const NAV_ITEMS = [
    { icon: "◫",  tip: "Workflows", on: true  },
    { icon: "▶",  tip: "Executions", on: false },
    { icon: "🔑", tip: "Credentials", on: false },
    { icon: "⚙",  tip: "Settings", on: false  },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F8FAFC", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Sidebar */}
      <div style={{ width: 52, background: "#1E293B", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 4, flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "#FF6D5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 14, boxShadow: "0 2px 8px rgba(255,109,90,0.4)" }}>⚡</div>
        {NAV_ITEMS.map(item => (
          <button key={item.tip} title={item.tip}
            style={{ width: 36, height: 36, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16, background: item.on ? "rgba(123,97,255,0.3)" : "transparent", color: item.on ? "#A78BFA" : "#475569", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {item.icon}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {/* Avatar — click to logout */}
        <div
          title="Sign out"
          onClick={handleLogout}
          style={{ width: 30, height: 30, borderRadius: "50%", background: "#7B61FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "white", fontWeight: 700, marginBottom: 12, cursor: "pointer" }}
        >
          JD
        </div>
      </div>

      {/* Main editor area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
