import React, {
  useEffect,
  useMemo,
  useState
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  Compass,
  MapPin,
  CalendarDays,
  Wallet,
  Plus,
  Trash2,
  LogOut,
  Search,
  ChevronRight,
  User,
  Building2,
  ArrowLeft,
  LoaderCircle
} from 'lucide-react';
import './styles.css';
import Chatbot from './Chatbot';

const API =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';

const request = async (
  path,
  options = {}
) => {
  const token =
    localStorage.getItem('token');

  const headers = {
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const response = await fetch(
    API + path,
    {
      ...options,
      headers
    }
  );

  if (!response.ok) {
    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (Array.isArray(data?.detail)) {
      throw new Error(
        data.detail
          .map((item) => item.msg)
          .join(', ')
      );
    }

    throw new Error(
      data?.detail ||
      data?.message ||
      'Something went wrong'
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

const authRequest = (
  path,
  body
) =>
  fetch(API + path, {
    method: 'POST',
    headers: {
      'Content-Type':
        'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(body)
  }).then(async (response) => {
    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.detail ||
        'Login failed'
      );
    }

    return data;
  });

const emptyTrip = {
  name: '',
  destination_id: '',
  total_days: 3,
  budget: 5000
};

async function searchAndWaitForStays(
  location,
  checkIn,
  checkOut,
  adults
) {
  const params =
    new URLSearchParams({
      location:
        String(location).trim(),
      check_in: checkIn,
      check_out: checkOut,
      adults: String(adults),
      limit: '10'
    });

  const searchResponse =
    await fetch(
      `${API}/stays/search?${params.toString()}`
    );

  let searchData;

  try {
    searchData =
      await searchResponse.json();
  } catch {
    throw new Error(
      'Invalid response from the stays service'
    );
  }

  console.log(
    'STAYS SEARCH RESPONSE:',
    searchData
  );

  if (!searchResponse.ok) {
    if (
      Array.isArray(
        searchData?.detail
      )
    ) {
      throw new Error(
        searchData.detail
          .map((item) => item.msg)
          .join(', ')
      );
    }

    throw new Error(
      searchData?.detail ||
      searchData?.message ||
      'Could not start hotel search'
    );
  }

  const jobId =
    searchData?.data?.jobId ||
    searchData?.data?.job_id ||
    searchData?.jobId ||
    searchData?.job_id;

  console.log(
    'STAYS JOB ID:',
    jobId
  );

  if (!jobId) {
    if (Array.isArray(searchData)) {
      return searchData;
    }

    if (
      Array.isArray(
        searchData?.data
      )
    ) {
      return searchData.data;
    }

    throw new Error(
      'No hotel search job ID received'
    );
  }

  for (
    let attempt = 0;
    attempt < 60;
    attempt++
  ) {
    await new Promise(
      (resolve) =>
        setTimeout(resolve, 5000)
    );

    const jobResponse =
      await fetch(
        `${API}/stays/jobs/${jobId}`
      );

    let jobData;

    try {
      jobData =
        await jobResponse.json();
    } catch {
      throw new Error(
        'Invalid response while checking hotel search'
      );
    }

    console.log(
      'STAYS JOB RESPONSE:',
      jobData
    );

    if (!jobResponse.ok) {
      throw new Error(
        jobData?.detail ||
        jobData?.message ||
        jobData?.data?.message ||
        'Could not check hotel search status'
      );
    }

    const status =
      String(
        jobData?.data?.status ||
        jobData?.status ||
        ''
      ).toLowerCase();

    if (
      status === 'completed' ||
      status === 'complete' ||
      status === 'done' ||
      status === 'success'
    ) {
      const result =
        jobData?.data?.result ??
        jobData?.data?.results ??
        jobData?.result ??
        jobData?.results ??
        [];

      if (Array.isArray(result)) {
        return result;
      }

      if (
        Array.isArray(
          result?.hotels
        )
      ) {
        return result.hotels;
      }

      if (
        Array.isArray(
          result?.properties
        )
      ) {
        return result.properties;
      }

      return [];
    }

    if (
      status === 'failed' ||
      status === 'error'
    ) {
      throw new Error(
        jobData?.data?.message ||
        jobData?.message ||
        'Hotel search failed'
      );
    }
  }

  throw new Error(
    'Hotel search is taking too long. Please try again.'
  );
}

function App() {
  const [token, setToken] =
    useState(
      localStorage.getItem('token')
    );

  /*
   * Read the current page from browser
   * history if it already exists.
   *
   * This also means refreshing the page
   * keeps the current React page.
   */
  const [page, setPage] =
    useState(
      () =>
        window.history.state?.page ||
        'home'
    );

  const [destinations, setDestinations] =
    useState([]);

  const [trips, setTrips] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [notice, setNotice] =
    useState('');
  useEffect(() => {
    if (!window.history.state?.page) {
      window.history.replaceState(
        {
          ...(window.history.state || {}),
          page: 'home'
        },
        '',
        window.location.href
      );
    }

    const handlePopState = (
      event
    ) => {
      setPage(
        event.state?.page ||
          'home'
      );
    };

    window.addEventListener(
      'popstate',
      handlePopState
    );

    return () => {
      window.removeEventListener(
        'popstate',
        handlePopState
      );
    };
  }, []);

  const loadDestinations =
    async () => {
      setLoading(true);

      try {
        const data =
          await request(
            '/destinations'
          );

        setDestinations(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (error) {
        setNotice(
          `Backend connection error: ${error.message}`
        );
      } finally {
        setLoading(false);
      }
    };

  const loadTrips =
    async () => {
      if (
        !localStorage.getItem(
          'token'
        )
      ) {
        return;
      }

      try {
        const data =
          await request(
            '/my-trips'
          );

        setTrips(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (error) {
        setNotice(
          error.message
        );
      }
    };

  useEffect(() => {
    loadDestinations();
  }, []);

  useEffect(() => {
    if (token) {
      loadTrips();
    }
  }, [token]);

  useEffect(() => {
    const handleTripUpdated = () => {
      loadTrips();
    };

    window.addEventListener(
      'tripUpdated',
      handleTripUpdated
    );

    return () => {
      window.removeEventListener(
        'tripUpdated',
        handleTripUpdated
      );
    };
  }, []);

  const logout = () => {
    localStorage.removeItem(
      'token'
    );

    sessionStorage.removeItem(
      'tripId'
    );

    setToken(null);
    setTrips([]);

    /*
     * Reset the current browser history
     * entry to the home page.
     */
    window.history.replaceState(
      {
        page: 'home'
      },
      '',
      window.location.href
    );

    setPage('home');
  };

  /*
   * Normal app navigation.
   *
   * IMPORTANT:
   * pushState creates an actual browser
   * history entry without reloading the page.
   *
   * So Chrome's Back button now knows
   * about our React page changes.
   */
  const nav = (newPage) => {
    if (page === newPage) {
      return;
    }

    window.history.pushState(
      {
        page: newPage
      },
      '',
      window.location.href
    );

    setPage(newPage);
  };

  /*
   * Keep the existing in-page Back button
   * working too, but make it use the same
   * browser history.
   */
  const goBack = () => {
    window.history.back();
  };

  if (
    !token &&
    ['trips', 'create'].includes(
      page
    )
  ) {
    return (
      <Auth
        onAuth={(newToken) => {
          localStorage.setItem(
            'token',
            newToken
          );

          setToken(newToken);
          setPage('trips');
        }}
      />
    );
  }

  const selectedDestination =
    JSON.parse(
      sessionStorage.getItem(
        'destination'
      ) || 'null'
    );

  return (
    <div>
      <Header
        token={token}
        page={page}
        nav={nav}
        logout={logout}
      />

      {notice && (
        <div className="notice">
          <span>{notice}</span>

          <button
            type="button"
            onClick={() =>
              setNotice('')
            }
          >
            ×
          </button>
        </div>
      )}

      <main className="container">
        {page === 'home' && (
          <Home
            destinations={
              destinations
            }
            loading={loading}
            nav={nav}
          />
        )}

        {page ===
          'destinations' && (
          <Destinations
            destinations={
              destinations
            }
            nav={nav}
          />
        )}

        {page === 'trips' && (
          <Trips
            trips={trips}
            destinations={
              destinations
            }
            nav={nav}
            reload={loadTrips}
          />
        )}

        {page === 'create' && (
          <CreateTrip
            destinations={
              destinations
            }
            nav={nav}
            reload={loadTrips}
          />
        )}

        {page === 'trip' && (
          <TripPlanner
            nav={nav}
          />
        )}

        {page === 'stays' && (
          <StaysPage
            destination={
              selectedDestination
            }
            nav={nav}
            goBack={goBack}
          />
        )}
      </main>
      <Chatbot />
    </div>
  );
}

function Header({
  token,
  page,
  nav,
  logout
}) {
  return (
    <header>
      <div className="nav container">
        <button
          type="button"
          className="brand"
          onClick={() =>
            nav('home')
          }
        >
          <Compass />
          Roamly
        </button>

        <nav>
          <button
            type="button"
            className={
              page === 'home'
                ? 'active'
                : ''
            }
            onClick={() =>
              nav('home')
            }
          >
            Discover
          </button>

          <button
            type="button"
            className={
              page === 'destinations'
                ? 'active'
                : ''
            }
            onClick={() =>
              nav('destinations')
            }
          >
            Destinations
          </button>

          {token && (
            <button
              type="button"
              className={
                page === 'trips'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                nav('trips')
              }
            >
              My Trips
            </button>
          )}
        </nav>

        <div className="nav-right">
          {token ? (
            <>
              <button
                type="button"
                className="iconbtn"
                onClick={() =>
                  nav('trips')
                }
              >
                <User size={19} />
              </button>

              <button
                type="button"
                className="logout"
                onClick={logout}
              >
                <LogOut size={17} />
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              className="primary"
              onClick={() =>
                nav('trips')
              }
            >
              Plan a trip
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function Home({
  destinations,
  loading,
  nav
}) {
  const [q, setQ] =
    useState('');

  const filtered =
    destinations
      .filter((destination) =>
        destination.name
          ?.toLowerCase()
          .includes(
            q.toLowerCase()
          )
      )
      .slice(0, 6);

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">
            YOUR NEXT STORY STARTS HERE
          </span>

          <h1>
            Travel smarter.
            <br />
            <em>
              Remember more.
            </em>
          </h1>

          <p>
            Discover destinations,
            build day-by-day
            itineraries and keep
            your next adventure
            beautifully organised.
          </p>

          <div className="search">
            <Search />

            <input
              value={q}
              onChange={(event) =>
                setQ(
                  event.target.value
                )
              }
              placeholder="Where do you want to go?"
            />

            <button
              type="button"
              className="primary"
              onClick={() =>
                nav(
                  'destinations'
                )
              }
            >
              Explore
            </button>
          </div>
        </div>

        <div className="hero-card">
          <MapPin />
          <span>
            Plan it your way
          </span>
          <strong>
            One trip at a time.
          </strong>
        </div>
      </section>

      <section className="section-head">
        <div>
          <span className="eyebrow">
            EXPLORE INDIA
          </span>

          <h2>
            Find your next escape
          </h2>
        </div>

        <button
          type="button"
          className="textbtn"
          onClick={() =>
            nav('destinations')
          }
        >
          See all
          <ChevronRight size={17} />
        </button>
      </section>

      <div className="grid">
        {loading ? (
          <p>
            Loading destinations...
          </p>
        ) : (
          filtered.map(
            (destination) => (
              <DestinationCard
                key={
                  destination.id
                }
                d={destination}
                nav={nav}
              />
            )
          )
        )}
      </div>
    </>
  );
}

function DestinationCard({
  d,
  nav
}) {
  return (
    <article className="card">
      <div className="card-image">
        {d.image_url ? (
          <img src={d.image_url} alt={d.name} />
        ) : (
    <MapPin size={28} />
      )}
      </div>

      <div className="card-body">
        <h3>{d.name}</h3>

        <p>
          {d.description ||
            'Discover unforgettable places and experiences.'}
        </p>

        <span className="best">
          Best time:{' '}
          {d.best_time ||
            'Anytime'}
        </span>

        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(
              'destination',
              JSON.stringify(d)
            );

            sessionStorage.removeItem(
              'tripId'
            );

            nav('trip');
          }}
        >
          Explore places
          <ChevronRight size={16} />
        </button>
      </div>
    </article>
  );
}

function Destinations({
  destinations,
  nav
}) {
  const [q, setQ] =
    useState('');

  const list =
    destinations.filter(
      (destination) =>
        `${destination.name || ''} ${
          destination.description ||
          ''
        }`
          .toLowerCase()
          .includes(
            q.toLowerCase()
          )
    );

  return (
    <>
      <div className="page-title">
        <span className="eyebrow">
          DISCOVER
        </span>

        <h1>
          Destinations
        </h1>

        <p>
          Choose a place and start
          building your journey.
        </p>
      </div>

      <div className="filter">
        <Search />

        <input
          placeholder="Search destinations"
          value={q}
          onChange={(event) =>
            setQ(
              event.target.value
            )
          }
        />
      </div>

      <div className="grid">
        {list.map(
          (destination) => (
            <DestinationCard
              key={
                destination.id
              }
              d={destination}
              nav={nav}
            />
          )
        )}
      </div>
    </>
  );
}

function Auth({
  onAuth
}) {
  const [mode, setMode] =
    useState('login');

  const [form, setForm] =
    useState({
      username: '',
      email: '',
      password: ''
    });

  const [err, setErr] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const submit = async (
    event
  ) => {
    event.preventDefault();

    setBusy(true);
    setErr('');

    try {
      if (
        mode === 'register'
      ) {
        await request(
          '/register',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify(
              form
            )
          }
        );

        setMode('login');

        setErr(
          'Account created! Please log in.'
        );
      } else {
        const data =
          await authRequest(
            '/login',
            {
              username:
                form.email,
              password:
                form.password
            }
          );

        onAuth(
          data.access_token
        );
      }
    } catch (error) {
      setErr(
        error.message
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <div className="auth-card">
        <Compass size={34} />

        <h1>
          {mode === 'login'
            ? 'Welcome back'
            : 'Create your account'}
        </h1>

        <p>
          {mode === 'login'
            ? 'Your adventures are waiting.'
            : 'Start planning your next adventure.'}
        </p>

        <form
          onSubmit={submit}
        >
          {mode ===
            'register' && (
            <input
              required
              minLength="3"
              placeholder="Username"
              value={
                form.username
              }
              onChange={(
                event
              ) =>
                setForm({
                  ...form,
                  username:
                    event.target
                      .value
                })
              }
            />
          )}

          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(event) =>
              setForm({
                ...form,
                email:
                  event.target
                    .value
              })
            }
          />

          <input
            required
            minLength="8"
            type="password"
            placeholder="Password"
            value={
              form.password
            }
            onChange={(event) =>
              setForm({
                ...form,
                password:
                  event.target
                    .value
              })
            }
          />

          {err && (
            <div className="form-error">
              {err}
            </div>
          )}

          <button
            type="submit"
            className="primary full"
            disabled={busy}
          >
            {busy
              ? 'Please wait...'
              : mode === 'login'
                ? 'Login'
                : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          className="switch"
          onClick={() => {
            setMode(
              mode === 'login'
                ? 'register'
                : 'login'
            );

            setErr('');
          }}
        >
          {mode === 'login'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Login'}
        </button>
      </div>
    </main>
  );
}

function Trips({
  trips,
  destinations,
  nav,
  reload
}) {
  const destinationName =
    (id) =>
      destinations.find(
        (destination) =>
          Number(
            destination.id
          ) === Number(id)
      )?.name ||
      'Destination';

  const del = async (id) => {
    if (
      !window.confirm(
        'Delete this trip?'
      )
    ) {
      return;
    }

    try {
      await request(
        `/trips/${id}`,
        {
          method: 'DELETE'
        }
      );

      reload();
    } catch (error) {
      alert(
        error.message
      );
    }
  };

  return (
    <>
      <div className="page-title row">
        <div>
          <span className="eyebrow">
            YOUR ADVENTURES
          </span>

          <h1>My Trips</h1>

          <p>
            Everything you are
            planning, in one
            place.
          </p>
        </div>

        <button
          type="button"
          className="primary"
          onClick={() =>
            nav('create')
          }
        >
          <Plus size={18} />
          New trip
        </button>
      </div>

      {trips.length === 0 ? (
        <div className="empty">
          <Compass size={42} />

          <h2>
            No trips yet
          </h2>

          <p>
            Your next adventure
            is one click away.
          </p>

          <button
            type="button"
            className="primary"
            onClick={() =>
              nav('create')
            }
          >
            Create your first
            trip
          </button>
        </div>
      ) : (
        <div className="trip-grid">
          {trips.map((trip) => (
            <article
              className="trip-card"
              key={trip.id}
            >
              <div className="trip-top">
                <span>
                  {destinationName(
                    trip.destination_id
                  )}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    del(trip.id)
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>

              <h2>
                {trip.name}
              </h2>

              <div className="trip-meta">
                <span>
                  <CalendarDays />
                  {trip.total_days}{' '}
                  days
                </span>

                <span>
                  <Wallet />
                  ₹
                  {Number(
                    trip.budget
                  ).toLocaleString()}
                </span>
              </div>

              <button
                type="button"
                className="textbtn"
                onClick={() => {
                  const destination =
                    destinations.find(
                      (item) =>
                        Number(
                          item.id
                        ) ===
                        Number(
                          trip.destination_id
                        )
                    );

                  sessionStorage.setItem(
                    'tripId',
                    String(
                      trip.id
                    )
                  );

                  if (
                    destination
                  ) {
                    sessionStorage.setItem(
                      'destination',
                      JSON.stringify(
                        destination
                      )
                    );
                  }

                  nav('trip');
                }}
              >
                Open itinerary
                <ChevronRight
                  size={17}
                />
              </button>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function CreateTrip({
  destinations,
  nav,
  reload
}) {
  const [trip, setTrip] =
    useState(emptyTrip);

  const [err, setErr] =
    useState('');

  const submit = async (
    event
  ) => {
    event.preventDefault();

    setErr('');

    try {
      await request(
        '/trips',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            ...trip,
            destination_id:
              Number(
                trip.destination_id
              ),
            total_days:
              Number(
                trip.total_days
              ),
            budget:
              Number(
                trip.budget
              )
          })
        }
      );

      await reload();
      nav('trips');
    } catch (error) {
      setErr(
        error.message
      );
    }
  };

  return (
    <div className="form-page">
      <span className="eyebrow">
        START PLANNING
      </span>

      <h1>
        Create a new trip
      </h1>

      <form
        className="trip-form"
        onSubmit={submit}
      >
        <label>
          Trip name

          <input
            required
            placeholder="e.g. Summer in the hills"
            value={trip.name}
            onChange={(event) =>
              setTrip({
                ...trip,
                name:
                  event.target
                    .value
              })
            }
          />
        </label>

        <label>
          Destination

          <select
            required
            value={
              trip.destination_id
            }
            onChange={(event) =>
              setTrip({
                ...trip,
                destination_id:
                  event.target
                    .value
              })
            }
          >
            <option value="">
              Choose a destination
            </option>

            {destinations.map(
              (destination) => (
                <option
                  key={
                    destination.id
                  }
                  value={
                    destination.id
                  }
                >
                  {
                    destination.name
                  }
                </option>
              )
            )}
          </select>
        </label>

        <div className="two">
          <label>
            Number of days

            <input
              type="number"
              min="1"
              value={
                trip.total_days
              }
              onChange={(event) =>
                setTrip({
                  ...trip,
                  total_days:
                    event.target
                      .value
                })
              }
            />
          </label>

          <label>
            Budget (₹)

            <input
              type="number"
              min="1"
              value={
                trip.budget
              }
              onChange={(event) =>
                setTrip({
                  ...trip,
                  budget:
                    event.target
                      .value
                })
              }
            />
          </label>
        </div>

        {err && (
          <div className="form-error">
            {err}
          </div>
        )}

        <button
          type="submit"
          className="primary full"
        >
          Create trip
        </button>
      </form>
    </div>
  );
}

function TripPlanner({
  nav
}) {
  const tripId =
    sessionStorage.getItem(
      'tripId'
    );

  const destination =
    JSON.parse(
      sessionStorage.getItem(
        'destination'
      ) || 'null'
    );

  const [places, setPlaces] =
    useState([]);

  const [details, setDetails] =
    useState(null);

  const [day, setDay] =
    useState(1);

  const [q, setQ] =
    useState('');

  const [category, setCategory] =
    useState('');

  const [err, setErr] =
    useState('');

  const [
    loadingPlaces,
    setLoadingPlaces
  ] = useState(false);

  const load = async (
    searchValue = q,
    categoryValue = category
  ) => {
    if (!destination?.name) {
      return;
    }

    setLoadingPlaces(true);
    setErr('');

    try {
      const params =
        new URLSearchParams();

      if (searchValue) {
        params.set(
          'search',
          searchValue
        );
      }

      if (categoryValue) {
        params.set(
          'category',
          categoryValue
        );
      }

      const placesPath =
        `/destinations/${encodeURIComponent(
          destination.name
        )}/places` +
        (params.toString()
          ? `?${params.toString()}`
          : '');

      const placesData =
        await request(
          placesPath
        );

      setPlaces(
        Array.isArray(
          placesData
        )
          ? placesData
          : []
      );

      if (tripId) {
        const tripData =
          await request(
            `/trips/${tripId}/details`
          );

        setDetails(
          tripData
        );
      }
    } catch (error) {
      setErr(
        error.message
      );
    } finally {
      setLoadingPlaces(
        false
      );
    }
  };

  useEffect(() => {
  load();

  const handleTripUpdated = () => {
    load();
  };

  window.addEventListener(
    'tripUpdated',
    handleTripUpdated
  );

  return () => {
    window.removeEventListener(
      'tripUpdated',
      handleTripUpdated
    );
  };
}, [
  destination?.id,
  tripId
]);

  const add = async (
    place
  ) => {
    if (!tripId) {
      setErr(
        'Create a trip first to add places to your itinerary.'
      );
      return;
    }

    try {
      await request(
        '/trip-places',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            trip_id:
              Number(
                tripId
              ),
            place_id:
              Number(
                place.id
              ),
            day_number:
              Number(day)
          })
        }
      );

      load();
    } catch (error) {
      setErr(
        error.message
      );
    }
  };

  const remove = async (
    place
  ) => {
    try {
      await request(
        `/trips/${tripId}/places/${place.id}`,
        {
          method: 'DELETE'
        }
      );

      load();
    } catch (error) {
      setErr(
        error.message
      );
    }
  };

  const cats = useMemo(
    () =>
      [
        ...new Set(
          places
            .map(
              (place) =>
                place.category
            )
            .filter(Boolean)
        )
      ],
    [places]
  );

  if (!destination) {
    return (
      <div className="empty">
        <h2>
          No destination selected
        </h2>

        <button
          type="button"
          className="primary"
          onClick={() =>
            nav('destinations')
          }
        >
          Browse destinations
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="planner-title">
        <div>
          <span className="eyebrow">
            DESTINATION
          </span>

          <h1>
            {destination.name}
          </h1>

          <p>
            {
              destination.description
            }
          </p>

          <div className="planner-actions">
            <button
              type="button"
              className="primary"
              onClick={() =>
                nav('stays')
              }
            >
              <Building2 size={19} />
              Find stays
            </button>

            {tripId && (
              <div className="budget-pill">
                <CalendarDays />
                {details?.total_days ||
                  '...'}{' '}
                day itinerary
              </div>
            )}
          </div>
        </div>
      </div>

      {err && (
        <div className="form-error">
          {err}
        </div>
      )}

      <div className="planner-layout">
        <section>
          <div className="toolbar">
            <div className="filter">
              <Search />

              <input
                placeholder="Search places"
                value={q}
                onChange={(event) =>
                  setQ(
                    event.target
                      .value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    'Enter'
                  ) {
                    load();
                  }
                }}
              />
            </div>

            <button
              type="button"
              className="secondary"
              onClick={() =>
                load()
              }
            >
              Search
            </button>
          </div>

          <div className="chips">
            <button
              type="button"
              className={
                !category
                  ? 'selected'
                  : ''
              }
              onClick={() => {
                setCategory('');
                load(q, '');
              }}
            >
              All
            </button>

            {cats.map(
              (item) => (
                <button
                  type="button"
                  className={
                    category ===
                    item
                      ? 'selected'
                      : ''
                  }
                  key={item}
                  onClick={() => {
                    setCategory(
                      item
                    );
                    load(
                      q,
                      item
                    );
                  }}
                >
                  {item}
                </button>
              )
            )}
          </div>

          {loadingPlaces ? (
            <div className="loading-state">
              <LoaderCircle
                className="spin"
                size={30}
              />

              <p>
                Loading places...
              </p>
            </div>
          ) : (
            <div className="places">
              {places.map(
                (place) => (
                  <article
                    className="place"
                    key={
                      place.id
                    }
                  >
                    <div className="place-img">
                      {place.image_url ? (
                        <img
                          src={
                            place.image_url
                          }
                          alt={
                            place.name
                          }
                        />
                      ) : (
                        <MapPin />
                      )}
                    </div>

                    <div>
                      <span className="best">
                        {
                          place.category
                        }
                      </span>

                      <h3>
                        {place.name}
                      </h3>

                      <p>
                        {place.description ||
                          place.address}
                      </p>

                      {place.rating && (
                        <small>
                          ★{' '}
                          {
                            place.rating
                          }
                          {place.city
                            ? ` · ${place.city}`
                            : ''}
                        </small>
                      )}
                    </div>

                    <button
                      type="button"
                      className="add"
                      onClick={() =>
                        add(place)
                      }
                    >
                      <Plus size={18} />
                    </button>
                  </article>
                )
              )}

              {!loadingPlaces &&
                places.length ===
                  0 && (
                  <p className="muted">
                    No places found.
                  </p>
                )}
            </div>
          )}
        </section>

        <aside className="itinerary">
          <h2>
            {details?.name ||
              'Build your itinerary'}
          </h2>

          {tripId ? (
            <>
              <div className="days">
                {Array.from(
                  {
                    length:
                      details?.total_days ||
                      1
                  },
                  (_, index) => (
                    <button
                      type="button"
                      className={
                        day ===
                        index + 1
                          ? 'selected'
                          : ''
                      }
                      key={index}
                      onClick={() =>
                        setDay(
                          index + 1
                        )
                      }
                    >
                      Day{' '}
                      {index + 1}
                    </button>
                  )
                )}
              </div>

              {details?.itinerary?.map(
                (item) =>
                  item.day_number ===
                    day && (
                    <div
                      key={
                        item.day_number
                      }
                    >
                      {item.places
                        ?.length ===
                      0 ? (
                        <p className="muted">
                          Nothing planned yet.
                        </p>
                      ) : (
                        item.places?.map(
                          (
                            place
                          ) => (
                            <div
                              className="it-place"
                              key={
                                place.id
                              }
                            >
                              <span>
                                {
                                  place.name
                                }
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  remove(
                                    place
                                  )
                                }
                              >
                                <Trash2
                                  size={
                                    15
                                  }
                                />
                              </button>
                            </div>
                          )
                        )
                      )}
                    </div>
                  )
              )}
            </>
          ) : (
            <div className="empty small">
              <p>
                Create a trip to
                save your
                itinerary.
              </p>

              <button
                type="button"
                className="primary"
                onClick={() =>
                  nav('create')
                }
              >
                Create trip
              </button>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function StaysPage({
  destination,
  nav,
  goBack
}) {
  const [checkIn, setCheckIn] =
    useState('');

  const [checkOut, setCheckOut] =
    useState('');

  const [adults, setAdults] =
    useState(2);

  const [stays, setStays] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [searched, setSearched] =
    useState(false);

  const [error, setError] =
    useState('');

  const locationName =
    typeof destination ===
    'string'
      ? destination
      : destination?.name || '';

  const handleSearch = async (
    event
  ) => {
    event.preventDefault();

    setError('');

    if (
      !checkIn ||
      !checkOut
    ) {
      setError(
        'Please select both check-in and check-out dates.'
      );
      return;
    }

    if (checkOut <= checkIn) {
      setError(
        'Check-out date must be after check-in date.'
      );
      return;
    }

    if (!locationName) {
      setError(
        'No destination was selected.'
      );
      return;
    }

    setLoading(true);
    setSearched(true);
    setStays([]);

    try {
      const results =
        await searchAndWaitForStays(
          locationName,
          checkIn,
          checkOut,
          adults
        );

      setStays(
        Array.isArray(results)
          ? results
          : []
      );
    } catch (err) {
      setError(
        err.message ||
        'Could not fetch stays.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getStayName =
    (stay) =>
      stay?.name ||
      stay?.title ||
      stay?.hotel?.name ||
      stay?.property?.name ||
      'Hotel';

  const getStayAddress =
    (stay) => {
      const address =
        stay?.address ||
        stay?.location ||
        stay?.hotel?.address ||
        stay?.property?.address;

      if (!address) {
        return '';
      }

      if (
        typeof address ===
        'string'
      ) {
        return address;
      }

      if (
        typeof address ===
        'object'
      ) {
        const parts = [
          address.city,
          address.country
        ].filter(Boolean);

        return parts.join(
          ', '
        );
      }

      return '';
    };

  const getStayRating =
    (stay) =>
      stay?.rating ??
      stay?.reviewScore ??
      stay?.hotel?.rating ??
      stay?.property?.rating ??
      null;

  const getStayPrice =
    (stay) => {
      const price =
        stay?.price ||
        stay?.pricePerNight ||
        stay?.hotel?.price ||
        stay?.property?.price;

      if (!price) {
        return null;
      }

      // USD → INR conversion
      const USD_TO_INR =
        95.8;

      if (
        typeof price ===
        'number'
      ) {
        return {
          nightly:
            price *
            USD_TO_INR,
          total: null
        };
      }

      if (
        typeof price ===
        'object'
      ) {
        return {
          nightly:
            price.nightlyPrice !=
            null
              ? price.nightlyPrice *
                USD_TO_INR
              : price.amount !=
                null
                ? price.amount *
                  USD_TO_INR
                : null,

          total:
            price.totalPrice !=
            null
              ? price.totalPrice *
                USD_TO_INR
              : null
        };
      }

      return null;
    };

  const getStayImage =
    (stay) =>
      stay?.image_url ||
      stay?.image ||
      stay?.thumbnail ||
      stay?.hotel?.image_url ||
      stay?.hotel?.image ||
      stay?.property?.image_url ||
      '';

  if (!destination) {
    return (
      <div className="empty">
        <h2>
          No destination selected
        </h2>

        <button
          type="button"
          className="primary"
          onClick={goBack}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="stays-page">
      <div className="stays-heading">
        <span className="eyebrow">
          ACCOMMODATION
        </span>

        <h1>
          Find your stay in{' '}
          {locationName}
        </h1>

        <p>
          Search for accommodation
          for your upcoming
          adventure.
        </p>
      </div>

      <form
        className="stay-search-form"
        onSubmit={handleSearch}
      >
        <div className="stay-field">
          <label>
            Check in
          </label>

          <input
            type="date"
            value={checkIn}
            min={
              new Date()
                .toISOString()
                .split('T')[0]
            }
            onChange={(event) =>
              setCheckIn(
                event.target
                  .value
              )
            }
            required
          />
        </div>

        <div className="stay-field">
          <label>
            Check out
          </label>

          <input
            type="date"
            value={checkOut}
            min={
              checkIn ||
              new Date()
                .toISOString()
                .split('T')[0]
            }
            onChange={(event) =>
              setCheckOut(
                event.target
                  .value
              )
            }
            required
          />
        </div>

        <div className="stay-field guests-field">
          <label>
            Guests
          </label>

          <input
            type="number"
            min="1"
            max="20"
            value={adults}
            onChange={(event) =>
              setAdults(
                Math.max(
                  1,
                  Number(
                    event.target
                      .value
                  )
                )
              )
            }
            required
          />
        </div>

        <button
          type="submit"
          className="primary stay-button"
          disabled={loading}
        >
          {loading ? (
            <>
              <LoaderCircle
                className="spin"
                size={19}
              />
              Searching...
            </>
          ) : (
            <>
              <Building2
                size={19}
              />
              Search stays
            </>
          )}
        </button>
      </form>

      <button
        type="button"
        className="back-button"
        onClick={goBack}
      >
        <ArrowLeft size={17} />
        Back
      </button>

      {loading && (
        <div className="stay-loading">
          <LoaderCircle
            className="spin"
            size={36}
          />

          <div>
            <h3>
              Finding stays for
              you...
            </h3>

            <p>
              This may take a few
              moments.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      {searched &&
        !loading &&
        !error &&
        stays.length ===
          0 && (
          <div className="empty">
            <Building2 size={42} />

            <h2>
              No stays found
            </h2>

            <p>
              Try different dates
              or search again.
            </p>
          </div>
        )}

      {!loading &&
        stays.length > 0 && (
          <>
            <div className="section-head stays-results-heading">
              <div>
                <span className="eyebrow">
                  RESULTS
                </span>

                <h2>
                  Places to stay in{' '}
                  {locationName}
                </h2>
              </div>

              <span className="result-count">
                {stays.length}{' '}
                stays found
              </span>
            </div>

            <div className="stays-grid">
              {stays.map(
                (
                  stay,
                  index
                ) => {
                  const name =
                    getStayName(
                      stay
                    );

                  const address =
                    getStayAddress(
                      stay
                    );

                  const rating =
                    getStayRating(
                      stay
                    );

                  const price =
                    getStayPrice(
                      stay
                    );

                  const image =
                    getStayImage(
                      stay
                    );

                  return (
                    <article
                      className="stay-card"
                      key={
                        stay?.id ||
                        stay?.hotelId ||
                        stay?.propertyId ||
                        `${name}-${index}`
                      }
                    >
                      <div className="stay-image">
                        {image ? (
                          <img
                            src={
                              image
                            }
                            alt={
                              name
                            }
                          />
                        ) : (
                          <Building2
                            size={
                              35
                            }
                          />
                        )}
                      </div>

                      <div className="stay-card-body">
                        <h3>
                          {name}
                        </h3>

                        {address && (
                          <p className="stay-location">
                            <MapPin
                              size={
                                16
                              }
                            />
                            {
                              address
                            }
                          </p>
                        )}

                        <div className="stay-info">
                          {rating && (
                            <span>
                              ⭐{' '}
                              {
                                rating
                              }
                            </span>
                          )}

                          {price?.nightly && (
                            <span className="stay-price">
                              ₹
                              {Math.round(
                                price.nightly
                              ).toLocaleString(
                                'en-IN'
                              )}
                              {' / night'}
                            </span>
                          )}

                          {price?.total && (
                            <span className="stay-total">
                              ₹
                              {Math.round(
                                price.total
                              ).toLocaleString(
                                'en-IN'
                              )}
                              {' total'}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          </>
        )}
    </div>
  );
}

createRoot(
  document.getElementById(
    'root'
  )
).render(<App />);