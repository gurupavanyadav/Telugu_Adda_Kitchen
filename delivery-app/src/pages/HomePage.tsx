import { UtensilsCrossed, Clock, MapPin, Bike, Heart, ChefHat, Leaf } from 'lucide-react';
import { navigate } from '@/lib/router';
import { getCurrentMealType } from '@/lib/utils';

export function HomePage() {
  const currentMeal = getCurrentMealType();

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-charcoal-900">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f9d54a' fill-opacity='0.4'%3E%3Cpath d='M30 30c0-5.523-4.477-10-10-10s-10 4.477-10 10 4.477 10 10 10 10-4.477 10-10zm10 0c0-5.523-4.477-10-10-10s-10 4.477-10 10 4.477 10 10 10 10-4.477 10-10z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative container-app py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-gold-400/20 px-4 py-1.5 text-sm font-medium text-gold-300 mb-6 animate-fade-in-up">
              <Leaf className="h-4 w-4" />
              Authentic Telugu Home Cooking
            </div>

            <h1 className="font-serif text-4xl md:text-6xl font-bold text-cream-50 leading-tight animate-fade-in-up">
              A taste of home,
              <br />
              <span className="text-gold-400">
                delivered to your hostel door.
              </span>
            </h1>

            <p className="mt-6 text-lg text-cream-200 leading-relaxed max-w-2xl animate-fade-in-up">
              Telugu Adda brings you authentic, home-style Telugu food — and a few Chinese favorites —
              right inside your college campus. Whether you're from Andhra, Telangana, or anywhere else,
              our food will remind you of home.
            </p>

            <div className="mt-8 flex flex-wrap gap-4 animate-fade-in-up">
              <button
                onClick={() => navigate('/menu')}
                className="btn-gold text-base px-8 py-3"
              >
                <UtensilsCrossed className="h-5 w-5" />
                View Today's Menu
              </button>

              <button
                onClick={() => navigate('/signup')}
                className="btn border-2 border-cream-300 text-cream-50 hover:bg-cream-50/10 text-base px-8 py-3"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>

        <div className="relative">
          <svg
            className="w-full h-12 md:h-20"
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
          >
            <path
              d="M0,40 C320,80 640,0 960,40 C1280,80 1440,20 1440,40 L1440,80 L0,80 Z"
              fill="#fdf9e9"
            />
          </svg>
        </div>
      </section>

      {/* Quick Info */}
      <section className="container-app -mt-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <Clock className="h-6 w-6" />
            </div>

            <div>
              <p className="font-semibold text-charcoal-800">Open Now</p>
              <p className="text-sm text-charcoal-500">
                Serving {currentMeal}
              </p>
            </div>
          </div>

          <div className="card p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gold-100 text-gold-700">
              <Bike className="h-6 w-6" />
            </div>

            <div>
              <p className="font-semibold text-charcoal-800">
                Hostel Delivery
              </p>
              <p className="text-sm text-charcoal-500">
                Delivered to your room
              </p>
            </div>
          </div>

          <div className="card p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-700">
              <MapPin className="h-6 w-6" />
            </div>

            <div>
              <p className="font-semibold text-charcoal-800">
                Campus Pickup
              </p>
              <p className="text-sm text-charcoal-500">
                Pick up from our counter
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="container-app py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Story Text */}
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 mb-4">
              <Heart className="h-4 w-4" />
              Our Story
            </div>

            <h2 className="font-serif text-3xl md:text-4xl font-bold text-charcoal-900 mb-6">
              Food that feels like it came from your mother's kitchen
            </h2>

            <div className="space-y-4 text-charcoal-600 leading-relaxed">
              <p>
                Telugu Adda was born from a simple thought — when you're away from home, the thing you
                miss most is the food. Not restaurant food, but <em>home</em> food. The kind that has
                your mother's touch, the kind that tastes of familiarity and comfort.
              </p>

              <p>
                We serve authentic Telugu dishes from Andhra and Telangana — from spicy gongura
                preparations to comforting curd rice — alongside a few Chinese favorites for when you
                want something different. Our menu changes daily, so there's always something new to
                look forward to.
              </p>

              <p>
                And we're not just for Telugu students. Anyone on campus is welcome — if you love good,
                honest, home-style food, this is your adda.
              </p>
            </div>
          </div>

          {/* Food Image Grid */}
          <div className="grid grid-cols-2 gap-4">
            <img
              src="https://images.pexels.com/photos/32797056/pexels-photo-32797056.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
              alt="Indian thali"
              className="rounded-xl shadow-lg h-64 w-full object-cover"
            />

            <img
              src="https://images.pexels.com/photos/23830980/pexels-photo-23830980.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
              alt="Chicken biryani"
              className="rounded-xl shadow-lg h-64 w-full object-cover mt-8"
            />

            <div className="relative -mt-4">
              <img
                src="https://images.pexels.com/photos/12392915/pexels-photo-12392915.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
                alt="Masala dosa"
                className="rounded-xl shadow-lg h-64 w-full object-cover"
              />
            </div>

            <img
              src="https://images.pexels.com/photos/28674534/pexels-photo-28674534.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
              alt="Chilli chicken"
              className="rounded-xl shadow-lg h-64 w-full object-cover mt-4"
            />
          </div>

          {/* Centered Badge */}
          <div className="md:col-span-2 flex justify-center -mt-6">
            <div className="flex items-center gap-2 rounded-xl bg-gold-400 px-5 py-3 shadow-xl z-10 whitespace-nowrap">
              <ChefHat className="h-6 w-6 text-charcoal-900" />

              <span className="font-serif font-bold text-charcoal-900">
                Home-style cooking
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Why Students Love Telugu Adda */}
      <section className="bg-cream-100 py-16 md:py-24">
        <div className="container-app">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-charcoal-900 text-center mb-12">
            Why students love Telugu Adda
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 mb-4">
                <UtensilsCrossed className="h-8 w-8" />
              </div>

              <h3 className="font-serif text-xl font-semibold text-charcoal-900 mb-2">
                Fresh Daily Menu
              </h3>

              <p className="text-charcoal-600 text-sm leading-relaxed">
                Breakfast, lunch, and dinner change every day. Both veg and non-veg options always
                available, with authentic Telugu and Chinese dishes.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-100 text-gold-700 mb-4">
                <Bike className="h-8 w-8" />
              </div>

              <h3 className="font-serif text-xl font-semibold text-charcoal-900 mb-2">
                Delivery or Pickup
              </h3>

              <p className="text-charcoal-600 text-sm leading-relaxed">
                Get your order delivered straight to your hostel room, or pick it up from our counter
                on campus. Pay on delivery — no card needed.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 text-green-700 mb-4">
                <Heart className="h-8 w-8" />
              </div>

              <h3 className="font-serif text-xl font-semibold text-charcoal-900 mb-2">
                Made Like Home
              </h3>

              <p className="text-charcoal-600 text-sm leading-relaxed">
                Every dish is cooked with the same care and spices you'd find in a Telugu home
                kitchen. Customize your spice level — extra spicy, less spicy, or roasted.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-app py-16 md:py-24">
        <div className="rounded-2xl bg-gradient-to-br from-primary-800 to-primary-900 px-8 py-12 md:px-16 md:py-16 text-center relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f9d54a' fill-opacity='0.4'%3E%3Cpath d='M30 30c0-5.523-4.477-10-10-10s-10 4.477-10 10 4.477 10 10 10 10-4.477 10-10zm10 0c0-5.523-4.477-10-10-10s-10 4.477-10 10 4.477 10 10 10 10-4.477 10-10z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-cream-50 mb-4">
              Hungry? Let's fix that.
            </h2>

            <p className="text-cream-200 text-lg mb-8 max-w-xl mx-auto">
              Check out what's cooking today and place your order in minutes.
            </p>

            <button
              onClick={() => navigate('/menu')}
              className="btn-gold text-base px-8 py-3"
            >
              <UtensilsCrossed className="h-5 w-5" />
              See Today's Menu
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
