const StatPill = ({ label, value, variant = 'blue' }) => {
  return (
    <div className={`stat-pill stat-pill--${variant}`}>
      <span className="stat-pill__label">{label}</span>
      <span className="stat-pill__value">{value}</span>
    </div>
  );
};

export default StatPill;
