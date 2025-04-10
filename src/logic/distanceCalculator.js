// Haversine formula to calculate the distance between two lat/lng coordinates
export const calculateDistance = (start, end) => {
    const R = 6371;
    const lat1 = start[0] * (Math.PI / 180);
    const lon1 = start[1] * (Math.PI / 180);
    const lat2 = end[0] * (Math.PI / 180);
    const lon2 = end[1] * (Math.PI / 180);
  
    const dlat = lat2 - lat1;
    const dlng = lon2 - lon1;
  
    const a =
      Math.sin(dlat / 2) * Math.sin(dlat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dlng / 2) * Math.sin(dlng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  };
  