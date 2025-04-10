import React, { useState } from "react";
import RouteInputs from "./components/RouteInputs";
import RouteMap from './components/RouteMap';
import { calculateDistance } from "./logic/distanceCalculator";

import "leaflet/dist/leaflet.css";

function App() {
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [distance, setDistance] = useState(null);

  const handleCoordinates = (startCoords, endCoords) => {
    setStart(startCoords); 
    setEnd(endCoords);

    // Calculate the distance between the start and end points
    if (startCoords && endCoords) {

      const calculatedDistance = calculateDistance(startCoords, endCoords);
      setDistance(calculatedDistance); 
    }
    
  };

  return (
    <div>
      <h1>Route Planner</h1>
      <RouteInputs onCoordinates={handleCoordinates} />
      {distance !== null && (
        <div>
          <h2>Distance: {distance.toFixed(2)} km</h2>
          <RouteMap start={start} end={end} />
        </div>
      )}
    </div>
  );
}

export default App;
