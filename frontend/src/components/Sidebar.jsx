export default function Sidebar({ title = "Menu", children }) {
  return (
    <aside className="card lesson-sidebar">
      <h3>{title}</h3>
      {children}
    </aside>
  );
}
