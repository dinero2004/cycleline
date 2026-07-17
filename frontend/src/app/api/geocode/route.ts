import { NextRequest, NextResponse } from "next/server";

interface NominatimPlace {
  display_name: string;
  lat: string;
  lon: string;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length < 3) {
    return NextResponse.json({ message: "Enter at least three characters." }, { status: 422 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      "User-Agent": "CycleLine/2.0 route planner",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    return NextResponse.json({ message: "The geocoding service is unavailable." }, { status: 502 });
  }

  const places = (await response.json()) as NominatimPlace[];
  const place = places[0];

  if (!place) {
    return NextResponse.json({ message: `No location matched “${query}”.` }, { status: 404 });
  }

  return NextResponse.json({
    name: place.display_name,
    coordinates: [Number(place.lat), Number(place.lon)],
  });
}
