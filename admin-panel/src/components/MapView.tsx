'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Delivery } from '@/types';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const dropoffIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const currentIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapViewProps {
  deliveries: Delivery[];
  selectedDelivery: Delivery | null;
}

export default function MapView({ deliveries, selectedDelivery }: MapViewProps) {
  const defaultCenter: [number, number] = [33.6844, 73.0479]; // Islamabad, Pakistan
  const defaultZoom = 12;

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {deliveries.map((delivery) => {
        const isSelected = selectedDelivery?.id === delivery.id;
        const opacity = isSelected ? 1 : 0.5;

        return (
          <div key={delivery.id}>
            {/* Pickup Marker */}
            <Marker
              position={[delivery.pickupLocation.latitude, delivery.pickupLocation.longitude]}
              icon={pickupIcon}
              opacity={opacity}
            >
              <Popup>
                <div>
                  <strong>Pickup Location</strong>
                  <p>{delivery.pickupLocation.address}</p>
                  <p className="text-sm text-gray-600">{delivery.volunteerName}</p>
                </div>
              </Popup>
            </Marker>

            {/* Dropoff Marker */}
            <Marker
              position={[delivery.dropoffLocation.latitude, delivery.dropoffLocation.longitude]}
              icon={dropoffIcon}
              opacity={opacity}
            >
              <Popup>
                <div>
                  <strong>Dropoff Location</strong>
                  <p>{delivery.dropoffLocation.address}</p>
                </div>
              </Popup>
            </Marker>

            {/* Current Location Marker (if available) */}
            {delivery.currentLocation && delivery.status === 'in_progress' && (
              <Marker
                position={[delivery.currentLocation.latitude, delivery.currentLocation.longitude]}
                icon={currentIcon}
                opacity={opacity}
              >
                <Popup>
                  <div>
                    <strong>Current Location</strong>
                    <p>{delivery.volunteerName}</p>
                    <p className="text-sm text-gray-600">In Progress</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Route Line */}
            <Polyline
              positions={[
                [delivery.pickupLocation.latitude, delivery.pickupLocation.longitude],
                delivery.currentLocation
                  ? [delivery.currentLocation.latitude, delivery.currentLocation.longitude]
                  : [delivery.dropoffLocation.latitude, delivery.dropoffLocation.longitude],
              ]}
              color={isSelected ? '#3B82F6' : '#9CA3AF'}
              weight={isSelected ? 3 : 2}
              opacity={opacity}
            />
          </div>
        );
      })}
    </MapContainer>
  );
}
