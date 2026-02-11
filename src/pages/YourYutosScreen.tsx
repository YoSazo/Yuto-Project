import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

export default function YourYutosScreen() {
  const navigate = useNavigate();
  const { yutoGroups } = useApp();

  const handleYutoClick = (yutoId: string) => {
    navigate(`/yuto/${yutoId}`);
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-12 pb-4">
        <img 
          alt="Yuto mascot" 
          className="w-12 h-12 object-contain" 
          src={imgYutoMascot} 
        />
        <h1 className="text-2xl font-bold text-black">Your Yutos</h1>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-24 space-y-4">
        {yutoGroups.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-gray-500 mb-5">No Yutos yet!</p>
            <button 
              onClick={() => navigate('/venues')}
              className="bg-black text-white rounded-full px-8 py-3 font-semibold hover:bg-gray-800 transition-colors"
            >
              Browse Venues
            </button>
          </div>
        ) : (
          /* Yuto Cards */
          yutoGroups.map((yuto) => (
            <div
              key={yuto.id}
              onClick={() => handleYutoClick(yuto.id)}
              className="bg-white border border-gray-200 rounded-3xl shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all"
            >
              {/* Top row: Name + Status */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 pr-3">
                  <h3 className="font-bold text-lg text-black truncate">{yuto.name}</h3>
                  <p className="text-sm text-gray-500">{yuto.venue.name}</p>
                </div>
                <span 
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                    yuto.status === 'active' 
                      ? 'bg-primary text-white' 
                      : yuto.status === 'completed'
                      ? 'bg-gray-200 text-gray-600'
                      : 'bg-warning-light text-yellow-700'
                  }`}
                >
                  {yuto.status === 'active' ? 'Active' : yuto.status === 'completed' ? 'Completed' : 'Pending'}
                </span>
              </div>

              {/* Bottom row: Members + Price */}
              <div className="flex items-center justify-between mt-4">
                {/* Member avatars */}
                <div className="flex items-center -space-x-2">
                  {yuto.members.slice(0, 4).map((member, i) => (
                    <div 
                      key={member.id}
                      className="w-8 h-8 rounded-full bg-black border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                    >
                      {member.initial}
                    </div>
                  ))}
                  {yuto.members.length > 4 && (
                    <div className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-bold">
                      +{yuto.members.length - 4}
                    </div>
                  )}
                </div>
                <p className="font-bold text-black">
                  {yuto.members.reduce((sum, m) => sum + m.amount, 0).toLocaleString()} KSH
                </p>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
