# React Route Planner

A route planning application built with **JavaScript** and **Leaflet**, allowing users to calculate and visualize routes between locations on an interactive map.

---

## How It Works

This project uses the **OpenStreetMap** API to display maps and calculate routes.

### API Key Setup

To access map services, ensure you have a valid API key.  
You need to include your API key in the request headers of `src/components/RouteMap.js`, under the `Authorization` property.

### Address Geocoding

The conversion of location names (e.g., countries, cities) into geographical coordinates is handled by:

### OpenStreetMap, Nominatim

This allows users to input human-readable locations like "Berlin" or "Zurich" and convert them into usable coordinates.

### Distance Calculation

The distance between two points is calculated using the **Haversine formula**, which accounts for the Earth's curvature.

Read more on the formula here:  
[https://en.wikipedia.org/wiki/Haversine_formula](https://en.wikipedia.org/wiki/Haversine_formula)

### Route Visualization

The route is rendered using **Leaflet.js**, a lightweight open-source JavaScript library for interactive maps.

---

## Setup

In your terminal:

```bash
# Navigate to the project directory
cd cycleline

# Install dependencies
npm install

# Start the development server
npm start
