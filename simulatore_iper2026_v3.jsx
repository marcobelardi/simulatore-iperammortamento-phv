import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

const BRACKETS = [
  { limit: 2500000, rate: 1.80, ires: 0.432, label: "180% (fino a 2,5M)" },
  { limit: 10000000, rate: 1.00, ires: 0.24, label: "100% (2,5M–10M)" },
  { limit: 20000000, rate: 0.50, ires: 0.12, label: "50% (10M–20M)" },
];

const fmt = (v) => new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(v);

function NumInput({ value, onChange, style }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  const handleFocus = () => { setEditing(true); setRaw(String(value || 0)); };
  const handleBlur = () => { setEditing(false); const n = parseInt(raw.replace(/\D/g, ""), 10); onChange(isNaN(n) ? 0 : n); };
  const handleChange = (e) => setRaw(e.target.value);
  return (
    <input
      type={editing ? "text" : "text"}
      value={editing ? raw : fmt(value || 0)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      style={{ ...style, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
    />
  );
}
const fmtE = (v) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtPct = (v) => (v * 100).toFixed(1) + "%";

const COLORS = { total: "#4f46e5", b40: "#2563eb", fer: "#059669", benefit: "#d97706", ref: "#ef4444" };

const initialBeni = [
  {
    id: "A1", name: "Isola robotizzata di pressofusione", classif: "All.IV·GI·P3", type: "b40",
    complex: true, value: 0,
    components: [
      { id: "A1.1", name: "Centro di lavoro CNC 5 assi", value: 800000, ae: 2026 },
      { id: "A1.2", name: "Robot antropomorfo di asservimento", value: 450000, ae: 2026 },
      { id: "A1.3", name: "Sistema di visione e controllo qualità", value: 350000, ae: 2027 },
      { id: "A1.4", name: "Nastro trasportatore intelligente", value: 200000, ae: 2027 },
    ],
  },
  { id: "A2", name: "Magazzino automatico verticale", classif: "All.IV·GI·P11", type: "b40", complex: false, value: 1200000, ae: 2026, components: [] },
  { id: "A3", name: "Linea di assemblaggio robotizzata", classif: "All.IV·GI·P3", type: "b40", complex: false, value: 900000, ae: 2027, components: [] },
  { id: "A4", name: "Sistema AGV trasporto interno", classif: "All.IV·GI·P4", type: "b40", complex: false, value: 400000, ae: 2027, components: [] },
  { id: "B1", name: "MES – Manufacturing Execution System", classif: "All.V·GI·P2", type: "b40", complex: false, value: 350000, ae: 2026, components: [] },
  { id: "B2", name: "Digital Twin piattaforma simulazione", classif: "All.V·GI·P3", type: "b40", complex: false, value: 250000, ae: 2027, components: [] },
  { id: "FV1", name: "Impianto fotovoltaico 500 kWp", classif: "FER·Fotovoltaico", type: "fer", complex: false, value: 600000, ae: 2027, components: [] },
];

function calcBeneValue(b) {
  if (b.complex && b.components.length > 0) return b.components.reduce((s, c) => s + (c.value || 0), 0);
  return b.value || 0;
}

function calcBrackets(amount) {
  let remaining = Math.min(amount, 20000000);
  let prev = 0;
  const result = [];
  let totalMagg = 0, totalBenefit = 0;
  for (const br of BRACKETS) {
    const inBracket = Math.max(0, Math.min(remaining, br.limit - prev));
    const magg = inBracket * br.rate;
    const benefit = inBracket * br.ires;
    result.push({ ...br, base: inBracket, maggiorazione: magg, benefit });
    totalMagg += magg;
    totalBenefit += benefit;
    remaining -= inBracket;
    prev = br.limit;
  }
  return { brackets: result, totalMagg, totalBenefit };
}

function MetricCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: accent ? "#1e293b" : "#f8fafc", borderRadius: 8, padding: "12px 16px", border: accent ? "none" : "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 11, color: accent ? "#94a3b8" : "#64748b", marginBottom: 2, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: accent ? "#fff" : "#0f172a", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: accent ? "#94a3b8" : "#64748b", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function Simulator() {
  const [beni, setBeni] = useState(initialBeni);

  const analysis = useMemo(() => {
    const years = {};
    const totals = { b40: 0, fer: 0 };
    for (const b of beni) {
      const val = calcBeneValue(b);
      totals[b.type] += val;
      if (b.complex && b.components.length > 0) {
        for (const c of b.components) {
          const y = c.ae || 2026;
          if (!years[y]) years[y] = { b40: 0, fer: 0, total: 0 };
          years[y][b.type] += c.value || 0;
          years[y].total += c.value || 0;
        }
      } else {
        const y = b.ae || 2026;
        if (!years[y]) years[y] = { b40: 0, fer: 0, total: 0 };
        years[y][b.type] += val;
        years[y].total += val;
      }
    }
    const yearKeys = Object.keys(years).sort();
    let grandBenefit = 0;
    const yearAnalysis = yearKeys.map((y) => {
      const d = years[y];
      const bc = calcBrackets(d.total);
      grandBenefit += bc.totalBenefit;
      return { year: y, ...d, ...bc };
    });
    return { totals, total: totals.b40 + totals.fer, yearAnalysis, grandBenefit };
  }, [beni]);

  const chartData = analysis.yearAnalysis.map((y) => ({ year: y.year, Montante: y.total }));
  const benefitData = analysis.yearAnalysis.map((y) => ({ year: y.year, Beneficio: y.totalBenefit }));

  const updateBeneField = (idx, field, val) => { const n = [...beni]; n[idx] = { ...n[idx], [field]: val }; setBeni(n); };
  const updateComponent = (bI, cI, field, val) => { const n = [...beni]; const c = [...n[bI].components]; c[cI] = { ...c[cI], [field]: val }; n[bI] = { ...n[bI], components: c }; setBeni(n); };
  const addBene = () => setBeni([...beni, { id: `N${Date.now().toString(36).slice(-3).toUpperCase()}`, name: "Nuovo bene", classif: "All.IV·GI·P1", type: "b40", complex: false, value: 100000, ae: 2026, components: [] }]);
  const removeBene = (i) => setBeni(beni.filter((_, j) => j !== i));
  const toggleComplex = (i) => { const n = [...beni]; const b = n[i]; if (!b.complex) { n[i] = { ...b, complex: true, components: [{ id: `${b.id}.1`, name: "Componente 1", value: b.value, ae: b.ae || 2026 }] }; } else { n[i] = { ...b, complex: false, value: b.components.reduce((s, c) => s + (c.value||0), 0), ae: b.components[0]?.ae || 2026, components: [] }; } setBeni(n); };
  const addComp = (i) => { const n = [...beni]; n[i] = { ...n[i], components: [...n[i].components, { id: `${n[i].id}.${n[i].components.length+1}`, name: "Nuovo componente", value: 0, ae: 2026 }] }; setBeni(n); };
  const removeComp = (bI, cI) => { const n = [...beni]; n[bI] = { ...n[bI], components: n[bI].components.filter((_, j) => j !== cI) }; setBeni(n); };

  const CTip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (<div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 12px", fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>AE {label}</div>
      {payload.map((p, i) => (<div key={i} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: 16 }}><span>{p.name}</span><span style={{ fontWeight: 500 }}>{fmt(p.value)} €</span></div>))}
    </div>);
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", maxWidth: 920, margin: "0 auto", padding: "0 8px" }}>
      <div style={{ borderBottom: "2px solid #0f172a", paddingBottom: 12, marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>LEAN4DIGITAL · Simulatore</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0, lineHeight: 1.3 }}>Iperammortamento 2026 — Calcolo beneficio e montanti annuali</h1>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>L. 199/2025, commi 427-436 · Fasce calcolate sul montante annuale totale (B4.0 + FER)</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        <MetricCard label="Investimento totale" value={fmtE(analysis.total)} sub={`B4.0: ${fmt(analysis.totals.b40)} + FER: ${fmt(analysis.totals.fer)}`} />
        <MetricCard label="Beneficio IRES totale" value={fmtE(analysis.grandBenefit)} sub={`Aliquota effettiva: ${fmtPct(analysis.total > 0 ? analysis.grandBenefit / analysis.total : 0)}`} accent />
        <MetricCard label="N. beni" value={beni.length} sub={`Di cui complessi: ${beni.filter(b => b.complex).length}`} />
        <MetricCard label="Periodi d’imposta" value={analysis.yearAnalysis.length} sub={analysis.yearAnalysis.map(y => y.year).join(", ")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".5px" }}>Montante annuale totale (B4.0 + FER)</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1e6).toFixed(1)}M`} />
                <Tooltip content={<CTip />} />
                <ReferenceLine y={2500000} stroke={COLORS.ref} strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "Soglia 2,5M", position: "insideTopRight", fontSize: 10, fill: COLORS.ref }} />
                <Bar dataKey="Montante" fill={COLORS.total} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".5px" }}>Beneficio IRES per anno</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={benefitData}>
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1e3).toFixed(0)}k`} />
                <Tooltip content={<CTip />} />
                <Bar dataKey="Beneficio" fill={COLORS.benefit} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {analysis.yearAnalysis.map((ya) => (
        <div key={ya.year} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>AE {ya.year}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#4f46e5", marginLeft: 10 }}>Montante totale: {fmt(ya.total)} €</span>
              <span style={{ fontSize: 11, color: "#64748b", marginLeft: 8 }}>(B4.0: {fmt(ya.b40)} + FER: {fmt(ya.fer)})</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#d97706" }}>Beneficio: {fmt(ya.totalBenefit)} €</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {ya.brackets.filter(br => br.base > 0).map((br, i) => (
              <div key={i} style={{ flex: 1, minWidth: 160, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px" }}>
                <div style={{ fontSize: 10, color: "#64748b" }}>{br.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(br.base)} € <span style={{ fontWeight: 400, color: "#64748b" }}>× {fmtPct(br.ires)}</span></div>
                <div style={{ fontSize: 12, color: "#d97706", fontWeight: 500 }}>= {fmt(br.benefit)} €</div>
              </div>
            ))}
          </div>
          {ya.total > 2500000 && <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 500 }}>⚠ Il montante annuale supera 2.500.000 €: {fmt(ya.total - 2500000)} € in seconda fascia (aliquota marginale 24%)</div>}
        </div>
      ))}

      <h3 style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 8, marginTop: 24, textTransform: "uppercase", letterSpacing: ".5px" }}>Elenco beni — modifica per simulare scenari</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ borderBottom: "2px solid #cbd5e1" }}>
            {["CB","Nome bene","Tipo","","Valore €","AE",""].map((h,i) => (<th key={i} style={{ textAlign: i===4?"right":"left", padding: "6px 4px", fontSize: 11, color: "#64748b", fontWeight: 500 }}>{h}</th>))}
          </tr></thead>
          <tbody>
            {beni.map((b, idx) => {
              const val = calcBeneValue(b);
              return (<React.Fragment key={b.id}>
                <tr style={{ borderBottom: "1px solid #e2e8f0", background: b.complex ? "#fffbeb" : "transparent" }}>
                  <td style={{ padding: "5px 4px", fontWeight: 600, fontSize: 11 }}>{b.id}</td>
                  <td style={{ padding: "5px 4px" }}><input value={b.name} onChange={e => updateBeneField(idx,"name",e.target.value)} style={{ border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 6px", fontSize: 12, width: "100%", background: "transparent" }} /></td>
                  <td style={{ padding: "5px 4px" }}><select value={b.type} onChange={e => updateBeneField(idx,"type",e.target.value)} style={{ border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 4px", fontSize: 11 }}><option value="b40">B4.0</option><option value="fer">FER</option></select></td>
                  <td style={{ padding: "5px 4px" }}><button onClick={() => toggleComplex(idx)} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, border: b.complex?"1px solid #d97706":"1px solid #cbd5e1", background: b.complex?"#fef3c7":"transparent", color: b.complex?"#92400e":"#64748b", cursor: "pointer" }}>{b.complex?"★ C":"C"}</button></td>
                  <td style={{ padding: "5px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.complex ? <span style={{ fontStyle: "italic", color: "#4f46e5", fontWeight: 500 }}>{fmt(val)}</span> : <NumInput value={b.value} onChange={v => updateBeneField(idx,"value",v)} style={{ border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 6px", fontSize: 12, width: 120 }} />}</td>
                  <td style={{ padding: "5px 4px" }}>{!b.complex && <select value={b.ae||2026} onChange={e => updateBeneField(idx,"ae",Number(e.target.value))} style={{ border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 4px", fontSize: 11 }}>{[2026,2027,2028].map(y => <option key={y} value={y}>{y}</option>)}</select>}</td>
                  <td style={{ padding: "5px 4px" }}><button onClick={() => removeBene(idx)} style={{ fontSize: 11, color: "#dc2626", background: "transparent", border: "none", cursor: "pointer" }}>✕</button></td>
                </tr>
                {b.complex && b.components.map((c,ci) => (
                  <tr key={c.id} style={{ borderBottom: "1px dashed #e2e8f0", background: "#fefce8" }}>
                    <td style={{ padding: "3px 4px 3px 16px", fontSize: 10, color: "#92400e" }}>↳ {c.id}</td>
                    <td style={{ padding: "3px 4px" }}><input value={c.name} onChange={e => updateComponent(idx,ci,"name",e.target.value)} style={{ border: "1px solid #fde68a", borderRadius: 4, padding: "1px 6px", fontSize: 11, width: "100%", background: "#fffbeb" }} /></td>
                    <td colSpan={2} style={{ padding: "3px 4px", fontSize: 10, color: "#a3a3a3" }}>ereditata</td>
                    <td style={{ padding: "3px 4px", textAlign: "right" }}><NumInput value={c.value} onChange={v => updateComponent(idx,ci,"value",v)} style={{ border: "1px solid #fde68a", borderRadius: 4, padding: "1px 6px", fontSize: 11, width: 110, background: "#fffbeb" }} /></td>
                    <td style={{ padding: "3px 4px" }}><select value={c.ae||2026} onChange={e => updateComponent(idx,ci,"ae",Number(e.target.value))} style={{ border: "1px solid #fde68a", borderRadius: 4, padding: "1px 3px", fontSize: 10, background: "#fffbeb" }}>{[2026,2027,2028].map(y => <option key={y} value={y}>{y}</option>)}</select></td>
                    <td style={{ padding: "3px 4px" }}><button onClick={() => removeComp(idx,ci)} style={{ fontSize: 10, color: "#dc2626", background: "transparent", border: "none", cursor: "pointer" }}>✕</button></td>
                  </tr>
                ))}
                {b.complex && <tr style={{ background: "#fefce8" }}><td colSpan={7} style={{ padding: "2px 16px" }}><button onClick={() => addComp(idx)} style={{ fontSize: 10, color: "#92400e", background: "transparent", border: "1px dashed #d97706", borderRadius: 4, padding: "1px 8px", cursor: "pointer" }}>+ componente</button></td></tr>}
              </React.Fragment>);
            })}
          </tbody>
        </table>
      </div>
      <button onClick={addBene} style={{ marginTop: 8, fontSize: 12, padding: "4px 16px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", color: "#334155" }}>+ Aggiungi bene</button>

      <div style={{ marginTop: 24, padding: 12, background: "#f1f5f9", borderRadius: 8, fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
        <strong>Note metodologiche.</strong> Le fasce progressive del comma 427 operano sul <strong>montante annuale totale</strong> (B4.0 + FER combinati), non separatamente per tipologia. Aliquote di beneficio effettivo IRES: 43,2% (= 180% × 24%) fino a 2,5M€; 24% (= 100% × 24%) da 2,5M a 10M€; 12% (= 50% × 24%) da 10M a 20M€. Criterio: per impresa e per periodo d’imposta. I beni complessi sono scomposti per componente ai fini dell’allocazione ai montanti annuali ex art. 109 TUIR.
      </div>
    </div>
  );
}
