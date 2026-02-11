import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getCategoryIcon, Venue } from '../data/mockData';
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

export default function HomeScreen() {
  const navigate = useNavigate();
  const { venues } = useApp();
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  const handleYutoIt = (venue: Venue) => {
    navigate('/create-yuto', { state: { venueId: venue.id } });
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-12 pb-4">
        <img alt="Yuto mascot" className="w-12 h-12 object-contain" src={imgYutoMascot} />
        <h1 className="text-2xl font-bold text-black">Venues</h1>
      </header>

      {/* Venue List */}
      <main className="flex-1 px-4 pb-24 space-y-3">
        {venues.map((venue) => (
          <div
            key={venue.id}
            onClick={() => setSelectedVenue(venue)}
            className="bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getCategoryIcon(venue.category)}</span>
              <p className="font-bold text-lg text-black">{venue.name}</p>
            </div>
            <p className="font-bold text-primary">{venue.price} KSH</p>
          </div>
        ))}
      </main>

      {/* Venue Detail Modal */}
      {selectedVenue && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
          onClick={() => setSelectedVenue(null)}
        >
          <div 
            className="bg-white rounded-t-3xl w-full max-w-md p-6 pb-10 shadow-xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close handle */}
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            
            <h2 className="font-bold text-2xl text-black mb-2">{selectedVenue.name}</h2>
            <p className="text-primary font-bold text-xl mb-4">
              {selectedVenue.price} KSH <span className="text-gray-500 font-normal text-sm">per person</span>
            </p>
            
            <p className="text-gray-600 mb-6 leading-relaxed">{selectedVenue.description}</p>
            
            <div className="space-y-3 text-sm text-gray-500 mb-8">
              <p>📍 {selectedVenue.location}</p>
              <p>⏰ {selectedVenue.hours}</p>
              <p>👥 Great for groups of 4-10</p>
            </div>

            <button
              onClick={() => handleYutoIt(selectedVenue)}
              className="w-full py-4 bg-black text-white font-bold text-lg rounded-full hover:bg-gray-800 transition-colors"
            >
              Yuto it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
