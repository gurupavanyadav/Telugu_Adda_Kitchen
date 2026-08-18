import { UtensilsCrossed, MapPin, Clock, Phone } from 'lucide-react';
import { navigate } from '@/lib/router';

export function Footer() {
  return (
    <footer className="bg-charcoal-900 text-cream-100 mt-16">
      <div className="container-app py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-700 text-gold-300">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-cream-50">Telugu Adda</h3>
                <p className="text-xs text-cream-300">Restaurant</p>
              </div>
            </div>
            <p className="text-sm text-cream-300 leading-relaxed">
              A taste of home, delivered to your hostel door. Authentic Telugu home-cooked food for
              every student on campus.
            </p>
          </div>

          <div>
            <h4 className="font-serif text-base font-semibold mb-4 text-gold-300">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><button onClick={() => navigate('/')} className="text-cream-300 hover:text-gold-300 transition-colors">Home</button></li>
              <li><button onClick={() => navigate('/menu')} className="text-cream-300 hover:text-gold-300 transition-colors">Today's Menu</button></li>
              <li><button onClick={() => navigate('/orders')} className="text-cream-300 hover:text-gold-300 transition-colors">My Orders</button></li>
              <li><button onClick={() => navigate('/profile')} className="text-cream-300 hover:text-gold-300 transition-colors">Profile</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-serif text-base font-semibold mb-4 text-gold-300">Contact & Info</h4>
            <ul className="space-y-3 text-sm text-cream-300">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-gold-400 shrink-0" />
                <span>Inside College Campus, Hostel Block Area</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-gold-400 shrink-0" />
                <span>Breakfast: 7-10 AM | Lunch: 12-3 PM | Dinner: 7-10 PM</span>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-0.5 text-gold-400 shrink-0" />
                <span>Delivery to all hostels | Pickup available</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-charcoal-700 text-center text-sm text-cream-400">
          <p>&copy; {new Date().getFullYear()} Telugu Adda Restaurant. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}