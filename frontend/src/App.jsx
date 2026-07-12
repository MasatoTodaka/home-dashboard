import Clock from './components/Clock';
import WeatherPanel from './components/WeatherPanel';
import CalendarPanel from './components/CalendarPanel';
import DevicesPanel from './components/DevicesPanel';
import './App.css';

function App() {
  return (
    <div className="dashboard">
      <div className="dashboard-top">
        <Clock />
        <WeatherPanel />
      </div>
      <div className="dashboard-bottom">
        <CalendarPanel />
        <DevicesPanel />
      </div>
    </div>
  );
}

export default App;
