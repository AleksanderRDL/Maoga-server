const SplashScreen = ({ message = 'Loading...' }) => {
  return (
    <div className="app-shell">
      <div className="splash">
        <div className="splash__spinner" />
        <p className="splash__message">{message}</p>
      </div>
    </div>
  );
};

export default SplashScreen;
