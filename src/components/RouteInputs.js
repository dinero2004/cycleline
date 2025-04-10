import { useState } from "react"; 
import RouteMap from './RouteMap';
import axios from "axios";

const geocode = async (place) => {
    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: {
          q: place, // Place (city, address, postal code)
          format: 'json',
          limit: 1, // You can limit it to one result
        },
      });
      if (response.data.length > 0) {
        // Get the first result's coordinates
        const lat = parseFloat(response.data[0].lat);
        const lon = parseFloat(response.data[0].lon);
        return [lat, lon];
      } else {
        throw new Error("Location not found.");
      }
    } catch (error) {
      console.error("Geocoding Error:", error);
      return null;
    }
  };
  
const RouteInputs = ({ onCoordinates }) => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const startCoordinates = await geocode(start);
    const endCoordinates = await geocode(end);

    if (startCoordinates && endCoordinates) {
      // Send coordinates back to App.js
      onCoordinates(startCoordinates, endCoordinates);
    } else {
      alert("Error finding location coordinates.");
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input 
          type="text" 
          value={start} 
          onChange={(e) => setStart(e.target.value)} 
          placeholder="Start location (City, Address, etc.)" 
        />
        <input 
          type="text" 
          value={end} 
          onChange={(e) => setEnd(e.target.value)} 
          placeholder="End location (City, Address, etc.)" 
        />
        <button type="submit">Calculate Route</button>
      </form>
    </div>
  );
};

export default RouteInputs;
