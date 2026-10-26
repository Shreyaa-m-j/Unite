import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import LocalGame from './pages/LocalGame.jsx';
import Create from './pages/Create.jsx';
import Room from './pages/Room.jsx';

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create" element={<Create />} />
        <Route path="/local" element={<LocalGame />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </div>
  );
}
