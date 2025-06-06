import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import axios from "axios";
import RouteMarker from './RouteMarker';

const RouteMap = ({ start, end }) => {
  const [route, setRoute] = useState([]);

  useEffect(() => {
    if (!start || !end) return;

    const getRoute = async () => {
      try {
        const response = await axios.post(
          "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
          {
            coordinates: [[...start].reverse(), [...end].reverse()],
          },
          {
            headers: {
              Authorization: "5b3ce3597851110001cf6248a6ad53f228754d51be2b665fc4b0192e", // your api_key goes here
              "Content-Type": "application/json",
            },
          }
        );
        const coords = response.data.features[0].geometry.coordinates;
        const latlngs = coords.map(coord => [coord[1], coord[0]]);
        setRoute(latlngs);
      } catch (error) {
        console.error("Error fetching route:", error);
      }
    };

    getRoute();
  }, [start, end]);

  return (
    <MapContainer center={start || [46.9481, 7.4474]} zoom={13} style={{ height: "100vh", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {start && <RouteMarker position={start} label="Starting Point (Start)" />}
      {end && <RouteMarker position={end} label="Destination (End)" />}
      {route.length > 0 && <Polyline positions={route} color="blue" />}
    </MapContainer>
  );
};

export default RouteMap;
