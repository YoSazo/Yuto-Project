import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

export default function YutoGroupScreen() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const { getYutoById } = useApp();
  
  const yuto = getYutoById(groupId || '');
  
  // Handle case where yuto doesn't exist
  if (!yuto) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-8">
        <p className="text-gray-500 mb-4">Yuto not found</p>
        <button 
          onClick={() => navigate('/home')}
          className="bg-black text-white rounded-full px-6 py-3 font-semibold"
        >
          Go Home
        </button>
      </div>
    );
  }

  const totalAmount = yuto.members.reduce((sum, m) => sum + m.amount, 0);
  const paidCount = yuto.members.filter(m => m.paid).length;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button 
          onClick={() => navigate('/home')}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <img alt="Yuto mascot" className="w-10 h-10 object-contain" src={imgYutoMascot} />
        <div className="flex-1">
          <h1 className="text-lg font-bold text-black">{yuto.name}</h1>
          <p className="text-sm text-gray-500">{yuto.venue.name}</p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-8 space-y-5">
        {/* Summary Card */}
        <div className="bg-primary rounded-3xl p-5 text-white">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-white/70 text-sm">Total</p>
              <p className="text-3xl font-bold">{totalAmount.toLocaleString()} KSH</p>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-sm">Per person</p>
              <p className="text-xl font-bold">{yuto.members[0]?.amount.toLocaleString()} KSH</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {yuto.members.slice(0, 4).map((m) => (
                <div key={m.id} className="w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center text-xs font-bold border-2 border-primary">
                  {m.initial}
                </div>
              ))}
            </div>
            <span className="text-white/80 text-sm">{yuto.members.length} people • {paidCount} paid</span>
          </div>
        </div>

        {/* Members List */}
        <div>
          <h2 className="font-semibold text-black mb-3">Members</h2>
          <div className="space-y-3">
            {yuto.members.map((member) => (
              <div 
                key={member.id}
                className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold">
                    {member.initial}
                  </div>
                  <div>
                    <p className="font-semibold text-black">{member.name}</p>
                    <p className="text-sm text-gray-500">{member.amount.toLocaleString()} KSH</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  member.paid 
                    ? 'bg-success-light text-green-700' 
                    : 'bg-warning-light text-yellow-700'
                }`}>
                  {member.paid ? 'Paid' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <button
            onClick={() => navigate(`/yuto/${groupId}/chat`, { state: { groupName: yuto.name } })}
            className="w-full py-4 bg-white border border-black text-black font-semibold rounded-full hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Group Chat
          </button>
          
          <button className="w-full py-4 bg-black text-white font-bold rounded-full hover:bg-gray-800 transition-colors">
            Pay Now - {yuto.members[0]?.amount.toLocaleString()} KSH
          </button>
        </div>
      </main>
    </div>
  );
}
