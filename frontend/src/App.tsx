import { useState, useRef, useCallback, useEffect } from "react";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";

const API_BASE = "http://127.0.0.1:8000";

// ─── Auth state ───────────────────────────────────────────────────────────────
type Page = "login" | "register" | "app";

type Profile = { username: string; email: string; role_name: string };

// Shape of a node type returned by GET /node-types
type NodeCatalogItem = {
  id: string;
  type: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
};

function useAuth() {
  const [page, setPage] = useState<Page>("login");
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // On first load, check if there's already a valid session and load profile
  useEffect(() => {
    fetch(`${API_BASE}/users/me`, { credentials: "include" })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error("not authenticated");
      })
      .then(data => {
        setProfile(data);
        setPage("app");
      })
      .catch(() => setPage("login"))
      .finally(() => setChecking(false));
  }, []);

  return { page, setPage, checking, profile, setProfile };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function App() {
  const { page, setPage, checking, profile, setProfile } = useAuth();

  function handleLoginSuccess(userData: Profile) {
    setProfile(userData);
    setPage("app");
  }

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
        onLoginSuccess={handleLoginSuccess}
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

  return <WorkflowApp onLogout={() => { setProfile(null); setPage("login"); }} profile={profile} />;
}

// ─── WorkflowApp ─────────────────────────────────────────────────────────────
function WorkflowApp({ onLogout, profile }: {
  onLogout: () => void; profile: { username: string; email: string; role_name: string } | null
}) {

  const NODE_TYPES = {
    trigger:   { color: "#FF6D5A", bg: "#FFF0EE", label: "Trigger" },
    action:    { color: "#7B61FF", bg: "#F0EEFF", label: "Action" },
    condition: { color: "#F5A623", bg: "#FFF8EC", label: "Condition" },
    transform: { color: "#36B37E", bg: "#E6F9F2", label: "Transform" },
    output:    { color: "#0052CC", bg: "#E6EEFF", label: "Output" },
  };

  const INITIAL_NODES = [
    { id: "n1", nodeId: "webhook", x: 80,  y: 200, name: "Webhook",      desc: "Listens for incoming HTTP requests and starts the workflow.", status: "idle", enabled: true  },
    { id: "n2", nodeId: "http",    x: 340, y: 200, name: "HTTP Request",  desc: "Sends an HTTP request to an external API endpoint.",         status: "idle", enabled: true  },
    { id: "n3", nodeId: "if",      x: 600, y: 200, name: "If / Else",     desc: "Routes data based on a true/false condition.",               status: "idle", enabled: true  },
    { id: "n4", nodeId: "slack",   x: 860, y: 100, name: "Slack",         desc: "Posts a message to a Slack channel or user.",                status: "idle", enabled: true  },
    { id: "n5", nodeId: "gmail",   x: 860, y: 330, name: "Gmail",         desc: "Sends or reads emails through a Gmail account.",             status: "idle", enabled: false },
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

  // ── Node catalog — fetched from the database ──────────────────────────────
  const [nodeCatalog, setNodeCatalog] = useState<NodeCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);

  useEffect(() => {
    setCatalogLoading(true);
    setCatalogError(false);
    fetch(`${API_BASE}/node-types`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch node types");
        return res.json();
      })
      .then((data: NodeCatalogItem[]) => setNodeCatalog(data))
      .catch(() => setCatalogError(true))
      .finally(() => setCatalogLoading(false));
  }, []);

  // Returns the catalog entry for a given nodeId, falling back to a safe
  // placeholder so nodes already on the canvas render even if the catalog
  // hasn't loaded yet or the id is no longer in the DB.
  function getCat(nodeId: string): NodeCatalogItem {
    return (
      nodeCatalog.find(c => c.id === nodeId) || {
        id: nodeId,
        type: "action",
        name: nodeId,
        description: "",
        icon: "⬡",
        sort_order: 0,
      }
    );
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
    const type = NODE_TYPES[cat.type] ?? NODE_TYPES.action;
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
    const type = NODE_TYPES[cat.type] ?? NODE_TYPES.action;
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

    const filtered = nodeCatalog.filter(n =>
      n.name.toLowerCase().includes(filter.toLowerCase()) ||
      n.type.toLowerCase().includes(filter.toLowerCase())
    );
    const grouped = ["trigger", "action", "condition", "transform", "output"].map(t => ({
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

          {/* Loading state */}
          {catalogLoading && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>
              Loading nodes…
            </div>
          )}

          {/* Error state with retry */}
          {!catalogLoading && catalogError && (
            <div style={{ padding: "24px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 12 }}>
                Could not load node types.
              </div>
              <button
                onClick={() => {
                  setCatalogError(false);
                  setCatalogLoading(true);
                  fetch(`${API_BASE}/node-types`)
                    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
                    .then((data: NodeCatalogItem[]) => setNodeCatalog(data))
                    .catch(() => setCatalogError(true))
                    .finally(() => setCatalogLoading(false));
                }}
                style={{ padding: "6px 14px", background: "#EDE9FF", color: "#7B61FF", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Loaded — grouped list */}
          {!catalogLoading && !catalogError && grouped.map(group => (
            <div key={group.type}>
              <div style={{ padding: "6px 16px 4px", fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.8px" }}>
                {NODE_TYPES[group.type]?.label.toUpperCase() ?? group.type.toUpperCase()}
              </div>
              {group.items.map(item => (
                <button key={item.id} onClick={() => onAdd(item.id)}
                  style={{ width: "100%", padding: "8px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: NODE_TYPES[item.type]?.bg ?? "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          ))}

          {/* Empty search result */}
          {!catalogLoading && !catalogError && grouped.length === 0 && filter && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>
              No nodes match "{filter}"
            </div>
          )}
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
      <div
        style={{ position: "fixed", top: y, left: x, background: "white", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 1000, minWidth: 160, overflow: "hidden" }}
        onMouseDown={e => e.stopPropagation()}
      >
        <button onClick={() => { onAddNode(); onClose(); }}
          style={{ width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 12, textAlign: "left", color: "#1E293B", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}>
          <span>＋</span> Add Node
        </button>
      </div>
    );
  }

  // ── State ─────────────────────────────────────────────────────────────────
  const uid = profile?.username ?? "guest";
  const K = { nodes: `wf_nodes_${uid}`, edges: `wf_edges_${uid}`, name: `wf_name_${uid}` };

  const [nodes, setNodes] = useState(() => {
    try { const s = localStorage.getItem(`wf_nodes_${uid}`); return s ? JSON.parse(s) : INITIAL_NODES; } catch { return INITIAL_NODES; }
  });
  const [edges, setEdges] = useState(() => {
    try { const s = localStorage.getItem(`wf_edges_${uid}`); return s ? JSON.parse(s) : INITIAL_EDGES; } catch { return INITIAL_EDGES; }
  });
  const [workflowName, setWorkflowName] = useState(() => {
    try { return localStorage.getItem(`wf_name_${uid}`) || "My Workflow"; } catch { return "My Workflow"; }
  });
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [rightPanel, setRightPanel]     = useState(null);
  const [zoom, setZoom]                 = useState(1);
  const [pan, setPan]                   = useState({ x: 60, y: 30 });
  const [showGrid, setShowGrid]         = useState(true);
  const [isActive, setIsActive]         = useState(true);
  const [running, setRunning]           = useState(false);
  const [pendingEdge, setPendingEdge]   = useState(null);
  const [ctxMenu, setCtxMenu]           = useState(null);
  const [showProfile, setShowProfile]   = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const svgRef        = useRef(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarRef     = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  // When the user changes, reload their saved state
  useEffect(() => {
    try {
      const savedNodes = localStorage.getItem(K.nodes);
      const savedEdges = localStorage.getItem(K.edges);
      const savedName  = localStorage.getItem(K.name);
      setNodes(savedNodes ? JSON.parse(savedNodes) : INITIAL_NODES);
      setEdges(savedEdges ? JSON.parse(savedEdges) : INITIAL_EDGES);
      setWorkflowName(savedName || "My Workflow");
    } catch {}
  }, [uid]);

  // Persist nodes, edges and workflow name
  useEffect(() => {
    try { localStorage.setItem(K.nodes, JSON.stringify(nodes)); } catch {}
  }, [nodes, K.nodes]);
  useEffect(() => {
    try { localStorage.setItem(K.edges, JSON.stringify(edges)); } catch {}
  }, [edges, K.edges]);
  useEffect(() => {
    try { localStorage.setItem(K.name, workflowName); } catch {}
  }, [workflowName, K.name]);

  // Keyboard delete handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNode) {
          setNodes(ns => ns.filter(n => n.id !== selectedNode));
          setEdges(es => es.filter(e => e.from !== selectedNode && e.to !== selectedNode));
          setSelectedNode(null);
          setRightPanel(null);
        } else if (selectedEdge) {
          setEdges(es => es.filter(e => e.id !== selectedEdge));
          setSelectedEdge(null);
          setRightPanel(null);
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedNode, selectedEdge]);

  function handleProfileEnter() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom - 220, left: rect.right + 12 });
    }
    setShowProfile(true);
  }

  function handleProfileLeave() {
    closeTimerRef.current = setTimeout(() => setShowProfile(false), 200);
  }

  const panRef     = useRef(null);
  const panelWidth = rightPanel ? 280 : 0;

  const selNode = nodes.find(n => n.id === selectedNode);
  const selEdge = edges.find(e => e.id === selectedEdge);

  function handleNodeSelect(id) { setSelectedNode(id); setSelectedEdge(null); setRightPanel("node"); }
  function handleNodeDrag(id, x, y) { setNodes(ns => ns.map(n => n.id === id ? { ...n, x, y } : n)); }
  function updateNode(id, patch)  { setNodes(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n)); }
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
  function updateEdge(id, patch) { setEdges(es => es.map(e => e.id === id ? { ...e, ...patch } : e)); }
  function deleteEdge(id) {
    setEdges(es => es.filter(e => e.id !== id));
    setSelectedEdge(null); setRightPanel(null);
  }

  // Uses the fetched catalog — desc maps to the DB "description" field
  function addNode(nodeId: string) {
    const cat = nodeCatalog.find(c => c.id === nodeId);
    if (!cat) return;
    const id = "n" + Date.now();
    setNodes(ns => [...ns, {
      id, nodeId, x: 200, y: 200,
      name: cat.name,
      desc: cat.description,
      status: "idle",
      enabled: true,
    }]);
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
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    onLogout();
  }

  const initials = profile?.username ? profile.username.slice(0, 2).toUpperCase() : "JD";

  const NAV_ITEMS = [
    { icon: "◫",  tip: "Workflows",   on: true  },
    { icon: "▶",  tip: "Executions",  on: false },
    { icon: "🔑", tip: "Credentials", on: false },
    { icon: "⚙",  tip: "Settings",    on: false },
  ];

  const sidebarWidth = sidebarExpanded ? 200 : 52;

  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex", overflow: "hidden",
      background: "#F8FAFC",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: sidebarWidth, background: "#1E293B",
        display: "flex", flexDirection: "column",
        alignItems: sidebarExpanded ? "flex-start" : "center",
        padding: "12px 0", gap: 4, flexShrink: 0,
        position: "relative", zIndex: 10,
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
      }}>
        <div onClick={() => setSidebarExpanded(s => !s)} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: sidebarExpanded ? "0 12px" : "0",
          justifyContent: sidebarExpanded ? "flex-start" : "center",
          marginBottom: 14, cursor: "pointer", boxSizing: "border-box",
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: "#FF6D5A",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0, boxShadow: "0 2px 8px rgba(255,109,90,0.4)",
            transition: "transform 0.15s",
          }}>⚡</div>
          {sidebarExpanded && (
            <span style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9", whiteSpace: "nowrap", letterSpacing: "-0.3px" }}>
              My Workflow
            </span>
          )}
        </div>

        {NAV_ITEMS.map(item => (
          <button key={item.tip} title={!sidebarExpanded ? item.tip : undefined} style={{
            width: sidebarExpanded ? "calc(100% - 16px)" : 36, height: 36,
            border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16,
            background: item.on ? "rgba(123,97,255,0.3)" : "transparent",
            color: item.on ? "#A78BFA" : "#475569",
            display: "flex", alignItems: "center",
            justifyContent: sidebarExpanded ? "flex-start" : "center",
            gap: 10, padding: sidebarExpanded ? "0 10px" : "0",
            marginLeft: sidebarExpanded ? 8 : 0, boxSizing: "border-box",
            transition: "width 0.22s cubic-bezier(0.4,0,0.2,1), background 0.15s",
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
            <span style={{ flexShrink: 0 }}>{item.icon}</span>
            {sidebarExpanded && <span style={{ fontSize: 12, fontWeight: item.on ? 700 : 500 }}>{item.tip}</span>}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Profile avatar */}
        <div ref={avatarRef} style={{
          position: "relative", marginBottom: 12, width: "100%",
          display: "flex", alignItems: "center",
          justifyContent: sidebarExpanded ? "flex-start" : "center",
          paddingLeft: sidebarExpanded ? 11 : 0, boxSizing: "border-box",
        }}
          onMouseEnter={handleProfileEnter}
          onMouseLeave={handleProfileLeave}
        >
          <div style={{
            width: 30, height: 30, borderRadius: "50%", background: "#7B61FF",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, color: "white", fontWeight: 700, cursor: "pointer",
            border: showProfile ? "2px solid #A78BFA" : "2px solid transparent",
            transition: "border-color 0.15s", flexShrink: 0,
          }}>
            {initials}
          </div>
          {sidebarExpanded && (
            <div style={{ marginLeft: 10, display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#F1F5F9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {profile?.username || "—"}
              </span>
              <span style={{ fontSize: 10, color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {profile?.email || "—"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main editor area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <div style={{ height: 52, background: "white", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 8, padding: "0 16px", flexShrink: 0 }}>
          <input value={workflowName} onChange={e => setWorkflowName(e.target.value)}
            style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", border: "1px solid transparent", borderRadius: 6, padding: "5px 8px", background: "transparent", outline: "none", fontFamily: "inherit" }}
            onFocus={e => e.target.style.borderColor = "#7B61FF"}
            onBlur={e => e.target.style.borderColor = "transparent"} />
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "#E6F9F2", color: "#36B37E", fontWeight: 700 }}>Saved</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowGrid(g => !g)}
            style={{ padding: "6px 10px", border: "1px solid #E2E8F0", borderRadius: 6, background: showGrid ? "#EDE9FF" : "white", color: showGrid ? "#7B61FF" : "#94A3B8", cursor: "pointer", fontSize: 12 }}>Grid</button>
          <button onClick={() => setZoom(z => Math.min(2, +(z+0.1).toFixed(1)))}
            style={{ padding: "6px 11px", border: "1px solid #E2E8F0", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 16, fontFamily: "monospace", lineHeight: 1, color: "#1E293B" }}>+</button>
          <span style={{ fontSize: 12, color: "#64748B", minWidth: 38, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.25, +(z-0.1).toFixed(1)))}
            style={{ padding: "6px 11px", border: "1px solid #E2E8F0", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 16, fontFamily: "monospace", lineHeight: 1, color: "#1E293B" }}>−</button>
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

      {/* ── Profile popover — fixed position so it escapes sidebar's overflow:hidden ── */}
      {showProfile && popoverPos && (
        <>
          <div style={{
            position: "fixed", top: popoverPos.top, left: popoverPos.left - 14,
            width: 14, height: 220, zIndex: 199,
          }}
            onMouseEnter={handleProfileEnter} onMouseLeave={handleProfileLeave}
          />
          <div style={{
            position: "fixed", top: popoverPos.top, left: popoverPos.left,
            width: 220, background: "#1E293B", border: "1px solid #334155",
            borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            overflow: "hidden", zIndex: 200,
          }}
            onMouseEnter={handleProfileEnter} onMouseLeave={handleProfileLeave}
          >
            <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #334155" }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "linear-gradient(135deg, #7B61FF, #A78BFA)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, color: "white", fontWeight: 700,
                marginBottom: 10, boxShadow: "0 2px 8px rgba(123,97,255,0.4)",
              }}>
                {initials}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9", marginBottom: 2 }}>{profile?.username || "—"}</div>
              <div style={{ fontSize: 11, color: "#64748B", wordBreak: "break-all" }}>{profile?.email || "—"}</div>
              {profile?.role_name && (
                <div style={{
                  display: "inline-block", marginTop: 8, fontSize: 10, fontWeight: 700,
                  padding: "2px 8px", borderRadius: 10,
                  background: "rgba(123,97,255,0.2)", color: "#A78BFA",
                  textTransform: "uppercase", letterSpacing: "0.5px",
                }}>
                  {profile.role_name}
                </div>
              )}
            </div>
            <button onClick={handleLogout} style={{
              width: "100%", padding: "11px 16px", background: "none", border: "none",
              cursor: "pointer", textAlign: "left", fontSize: 12, fontWeight: 600,
              color: "#F87171", display: "flex", alignItems: "center", gap: 8,
              fontFamily: "inherit", transition: "background 0.15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <span style={{ fontSize: 14 }}>→</span> Sign Out
            </button>
          </div>
        </>
      )}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          onAddNode={() => setRightPanel("add")}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
