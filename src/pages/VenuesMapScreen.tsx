import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getCategoryIcon, Venue } from '../data/mockData';
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

export default function VenuesMapScreen() {
  const navigate = useNavigate();
  const { venues } = useApp();
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  
  const handleGetDirections = (venue: Venue) => {
    if (venue.coordinates) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${venue.coordinates.lat},${venue.coordinates.lng}`;
      window.open(url, '_blank');
    }
  };

  const handleYutoIt = (venue: Venue) => {
    navigate('/create-yuto', { state: { venueId: venue.id } });
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-12 pb-4">
        <img alt="Yuto mascot" className="w-12 h-12 object-contain" src={imgYutoMascot} />
        <h1 className="text-2xl font-bold text-black">Venues Near You</h1>
      </header>

      {/* Venue List */}
      <main className="flex-1 px-4 pb-24 space-y-4">
        {venues.map((venue) => (
          <div
            key={venue.id}
            onClick={() => setSelectedVenue(venue)}
            className="bg-white border border-gray-200 rounded-3xl shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all"
          >
            <div className="flex items-start gap-4">
              {/* Category Icon */}
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl shrink-0">
                {getCategoryIcon(venue.category)}
              </div>
              
              {/* Venue Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-black">{venue.name}</h3>
                <p className="text-sm text-gray-500">{venue.location}</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {venue.category}
                </span>
              </div>
              
              {/* Price */}
              <span className="bg-primary text-white text-xs font-semibold px-3 py-1 rounded-full shrink-0">
                {venue.price} KSH
              </span>
            </div>
          </div>
        ))}
      </main>

      {/* Venue Detail Modal */}
      {selectedVenue && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5"
          onClick={() => setSelectedVenue(null)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button 
              onClick={() => setSelectedVenue(null)}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            {/* Icon */}
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              {getCategoryIcon(selectedVenue.category)}
            </div>

            {/* Name & Location */}
            <h2 className="font-bold text-2xl text-black text-center mb-1">{selectedVenue.name}</h2>
            <p className="text-sm text-gray-500 text-center mb-3">📍 {selectedVenue.location}</p>
            
            {/* Tags */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="bg-primary text-white text-xs font-semibold px-3 py-1 rounded-full">
                {selectedVenue.price} KSH
              </span>
              <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                {selectedVenue.category}
              </span>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 text-center mb-4 leading-relaxed">
              {selectedVenue.description}
            </p>

            {/* Hours */}
            <div className="bg-gray-50 rounded-2xl p-3 mb-5">
              <p className="text-xs text-gray-500 text-center">
                🕐 {selectedVenue.hours}
              </p>
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => handleYutoIt(selectedVenue)}
                className="w-full py-3 bg-black text-white font-bold rounded-full hover:bg-gray-800 transition-colors"
              >
                Yuto it! 🎉
              </button>
              
              {selectedVenue.coordinates && (
                <button
                  onClick={() => handleGetDirections(selectedVenue)}
                  className="w-full py-3 bg-white text-black font-semibold rounded-full border border-black hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                  </svg>
                  Get Directions
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
