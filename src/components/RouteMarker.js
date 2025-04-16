// src/components/CustomMarker.js
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import pinIcon from '../assets/pin.png'; // adjust path if needed

const customIcon = new L.Icon({
  iconUrl: pinIcon,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const CustomMarker = ({ position, label }) => {
  return (
    <Marker position={position} icon={customIcon}>
      <Popup>{label}</Popup>
    </Marker>
  );
};

export default CustomMarker;
