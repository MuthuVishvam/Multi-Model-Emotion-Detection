export default function StatCard({ label, value, tone = "neutral" }) {
  return (
    <article className={`card stat-card stat-card--${tone}`}>
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">{value}</strong>
    </article>
  );
}
