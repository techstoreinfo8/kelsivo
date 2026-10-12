
import { useEffect, useState } from 'react'
import AdminLogin from './AdminLogin'
import './App.css'
import { Menu, X, Truck, PackageSearch } from 'lucide-react';

const API_BASE_URL = (
  //import.meta.env.VITE_API_BASE_URL || 'https://kelsivo-api.onrender.com'
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).replace(/\/+$/, '')

const INITIAL_ORDER = {
  service: 'Parcel Delivery',
  pickup: '',
  delivery: '',
  details: '',
  phone: '',
  email: '',
};

const ORDER_STATUSES = [
  'New Request',
  'Quote Sent',
  'Confirmed',
  'In Transit',
  'Completed',
  'Cancelled',
]

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString()
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [page, setPage] = useState(() => {
  return window.location.pathname === '/admin'
    ? 'admin'
    : 'home'
})
  const [orders, setOrders] = useState([])
  const [trackingId, setTrackingId] = useState('')
const [trackingPhone, setTrackingPhone] = useState('')
const [trackingResult, setTrackingResult] = useState(null)
const [trackingError, setTrackingError] = useState('')
const [trackingLoading, setTrackingLoading] = useState(false)
  const [order, setOrder] = useState({ ...INITIAL_ORDER })

  const [selectedOrder, setSelectedOrder] = useState(null)
  const [success, setSuccess] = useState(false)

  const [token, setToken] = useState(
    () => sessionStorage.getItem('kelsivo-admin-token') || ''
  )

  const [admin, setAdmin] = useState(null)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [updatingOrderId, setUpdatingOrderId] = useState(null)

  const [apiError, setApiError] = useState('')
  const [orderError, setOrderError] = useState('')

  // Load orders from MySQL when an authenticated admin opens the dashboard.
  useEffect(() => {
    if (page !== 'admin' || !token) return

    const controller = new AbortController()

    async function loadOrders() {
      setLoadingOrders(true)
      setApiError('')

      try {
        const response = await fetch(`${API_BASE_URL}/api/orders`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        })

       const data = await response.json()

if (response.status === 401 || response.status === 403) {
  handleLogout()
  return
}

if (!response.ok || !data.success) {
  throw new Error(data.message || 'Unable to load orders.')
}

        setOrders(data.orders)
      } catch (error) {
        if (error.name === 'AbortError') return

        setApiError(error.message || 'Unable to connect to Kelsivo API.')

        if (error.message.includes('expired') ||
            error.message.includes('Admin login is required')) {
          handleLogout()
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingOrders(false)
        }
      }
    }

    loadOrders()

    return () => controller.abort()
  }, [page, token])

  function handleAdminLogin(newToken, adminInfo) {
    sessionStorage.setItem('kelsivo-admin-token', newToken)
    setToken(newToken)
    setAdmin(adminInfo)
    setApiError('')
    setPage('admin')
  }


  

const handleTrackOrder = async (event) => {
  event.preventDefault();

  console.log('Track My Order clicked');
  console.log('API_BASE_URL:', API_BASE_URL);

  setTrackingResult(null);
  setTrackingError('');

  if (!trackingId.trim() || !trackingPhone.trim()) {
    setTrackingError(
      'Enter your Order ID and booking phone number.'
    );
    return;
  }

  setTrackingLoading(true);

  try {
    const params = new URLSearchParams({
      orderId: trackingId.trim(),
      phone: trackingPhone.trim(),
    });

    const url =
      `${API_BASE_URL}/api/orders/track?${params.toString()}`;

    console.log('Tracking request URL:', url);

    const response = await fetch(url);

    console.log('Tracking response status:', response.status);

    const data = await response.json();

    console.log('Tracking response data:', data);

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || 'Unable to find your order.'
      );
    }

    setTrackingResult(data.order);
  } catch (error) {
    console.error('Track order error:', error);

    setTrackingError(
      error.message || 'Unable to track your order. Please try again.'
    );
  } finally {
    setTrackingLoading(false);
  }
};


  function handleLogout() {
    sessionStorage.removeItem('kelsivo-admin-token')
    setToken('')
    setAdmin(null)
    setOrders([])
    setSelectedOrder(null)
    setApiError('')
    setPage('admin')
  }

  function handleChange(event) {
    const { name, value } = event.target

    setOrder((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  // Submit the customer's order to the backend, not localStorage.
  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setOrderError('')
    setSuccess(false)

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
      })

     const data = await response.json()

if (response.status === 401 || response.status === 403) {
  handleLogout()
  return
}

if (!response.ok || !data.success) {
  throw new Error(data.message || 'Unable to update order status.')
}

      setOrder({ ...INITIAL_ORDER })
      setSuccess(true)
    } catch (error) {
      setOrderError(
        error.message || 'Unable to connect to Kelsivo. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Update the order status in MySQL and then refresh the local display.
  async function updateStatus(id, status) {
    if (!token) {
      setApiError('Please log in as admin again.')
      return
    }

    setUpdatingOrderId(id)
    setApiError('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/orders/${encodeURIComponent(id)}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to update order status.')
      }

      setOrders((previous) =>
        previous.map((item) =>
          String(item.id) === String(id)
            ? data.order
            : item
        )
      )
    } catch (error) {
      setApiError(error.message || 'Unable to update order status.')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  return (
    <div className="app">
      {/* NAVIGATION */}
      <header className="navbar">
        <button
          className="brand-button"
          onClick={() => setPage('home')}
        >
          <h1 className="logo">
            Kelsivo<span>.</span>
          </h1>
        </button>

{/* DESKTOP NAVIGATION */}
<nav className="main-nav desktop-nav">
  {[
    ['Home', 'home'],
    ['Services', 'services'],
    ['Track My Order', 'tracking'],
    ['Safety', 'safety'],
    ['Careers', 'careers'],
    ['Contact Us', 'contact'],
  ].map(([label, target]) => (
    <button
      key={target}
      className={`nav-link ${page === target ? 'active' : ''}`}
      onClick={() => setPage(target)}
    >
      {label}
    </button>
  ))}
</nav>

{/* MOBILE HAMBURGER BUTTON */}

<button
  className="menu-toggle mobile-menu-toggle"
  onClick={() => setMenuOpen((previous) => !previous)}
  aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
  aria-expanded={menuOpen}
  aria-controls="kelsivo-mobile-menu"
  type="button"
>
  <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
</button>

{menuOpen && (
  <div
    className="menu-overlay"
    onClick={() => setMenuOpen(false)}
  />
)}

<aside
  id="kelsivo-mobile-menu"
  className={`side-menu ${menuOpen ? 'open' : ''}`}
  aria-label="Mobile navigation"
  aria-hidden={!menuOpen}
>
  <div className="side-menu-header">
    <h2>Kelsivo<span>.</span></h2>

    <button
      className="menu-close"
      onClick={() => setMenuOpen(false)}
      aria-label="Close menu"
    >
      ✕
    </button>
  </div>

  {[
    ['⌂', 'Home', 'home'],
    ['▦', 'Services', 'services'],
    ['⌕', 'Track My Order', 'tracking'],
    ['✓', 'Safety', 'safety'],
    ['▣', 'Careers', 'careers'],
    ['✉', 'Contact Us', 'contact'],
  ].map(([icon, label, target]) => (
    <button
      key={target}
      className={`side-menu-link ${page === target ? 'active' : ''}`}
      onClick={() => {
        setPage(target)
        setMenuOpen(false)
      }}
    >
      <span className="side-menu-icon">{icon}</span>
      {label}
    </button>
  ))}
</aside>
<button
  className="download-app-btn"
  onClick={() => setPage('app')}
>
  Download App
</button>

      </header>

      <main>
       
        {/* HOME PAGE */}
        {page === 'home' && (
          <section className="hero home-hero">
            <div className="home-hero-content">
              <p className="tagline">KELSIVO DELIVERY</p>

              <h2 className="home-hero-title">
                Delivery made easy.
              </h2>

              <p className="description">
                Shop pickups, parcels and documents delivered
                to your doorstep.
              </p>

              <button
                className="primary-btn home-book-btn"
                onClick={() => {
                  setSuccess(false)
                  setOrderError('')
                  setPage('booking')
                }}
              >
                Book a Delivery →
              </button>
            </div>

            <div className="delivery-card home-delivery-card">
              <div className="delivery-icon">🛵</div>

              <div>
                <h3>Local delivery, made easy</h3>
                <p>From nearby shops to your doorstep.</p>
              </div>
            </div>
          </section>
        )}


{/* SERVICES PAGE */}
{page === 'services' && (
  <section className="services page-content">

    <h3 className="premium-services-title">
      Our services
    </h3>

    <p className="section-subtitle">
      Choose a service to get started.
    </p>

    <div className="service-grid">
      {[
        ['🛍️', 'Shop Pickup'],
        ['📦', 'Parcel Delivery'],
        ['📄', 'Document Delivery'],
        ['🛒', 'Daily Essentials'],
      ].map(([icon, name]) => (
        <button
          className="service-card"
          key={name}
          onClick={() => {
            setOrder((previous) => ({
              ...previous,
              service: name,
            }))
            setSuccess(false)
            setOrderError('')
            setPage('booking')
          }}
        >
          <span>{icon}</span>
          <h3>{name}</h3>
          <p>Tap to request this service.</p>
        </button>
      ))}
    </div>
    
    <button
      className="primary-btn services-book-btn"
      onClick={() => setPage('booking')}
    >
      Book Delivery →
    </button>
  </section>
)}

{/* DOWNLOAD APP PAGE */}
{page === 'app' && (
  <section className="page-content info-page">
    <p className="tagline">KELSIVO ON THE GO</p>
    <h2>Get the Kelsivo App</h2>

    <p className="section-subtitle">
      Enjoy convenient access to Kelsivo from your
      mobile device.
    </p>

    <div className="info-card">
      <h3>Coming Soon</h3>
      <p>
        App download links will appear here when the
        Android or iOS app is ready for release.
      </p>
    </div>

    <button
      className="primary-btn"
      onClick={() => setPage('booking')}
    >
      Book Delivery Online →
    </button>
  </section>
)}


        {/* BOOKING PAGE */}
        {page === 'booking' && (
          <section className="order-section page-content">
           <h2>Book your delivery</h2>
            <p className="section-subtitle">
            Enter your delivery details to get started.
           </p>

            {success ? (
              <div className="success-message">
                <h3>Booking Submitted Successfully! 🎉</h3>

<p>Your request has been received and saved successfully. Our team will review your booking and update its status shortly.</p>

<h4>Next Steps</h4>

<ul>
<li>Your booking status is currently <strong>New Request</strong>.</li>
<li>Check your email for booking confirmation, if provided.</li>
<li>Use <strong>Track My Order</strong> to check your booking status.</li>
</ul>

<p>Thank you for choosing Kelsivo!</p>

                <button
                  className="primary-btn"
                  onClick={() => setPage('home')}
                >
                  Back to Home →
                </button>
              </div>
            ) : (
              <form
                className="order-form"
                onSubmit={handleSubmit}
              >
                <h3>Delivery details</h3>

                <label>
                  Select a service
                  <select
                    name="service"
                    value={order.service}
                    onChange={handleChange}
                    required
                  >
                    <option>Shop Pickup</option>
                    <option>Parcel Delivery</option>
                    <option>Document Delivery</option>
                    <option>Daily Essentials</option>
                  </select>
                </label>

                <label>
                  Pickup address
                  <input
                    name="pickup"
                    value={order.pickup}
                    onChange={handleChange}
                    placeholder="Enter pickup address"
                    required
                  />
                </label>

                <label>
                  Delivery address
                  <input
                    name="delivery"
                    value={order.delivery}
                    onChange={handleChange}
                    placeholder="Enter delivery address"
                    required
                  />
                </label>

                <label>
                  Item details
                  <textarea
                    name="details"
                    value={order.details}
                    onChange={handleChange}
                    placeholder="What needs to be picked up?"
                    required
                  />
                </label>

                <label>
                  Contact number
                  <input
                    name="phone"
                    type="tel"
                    value={order.phone}
                    onChange={handleChange}
                    placeholder="Enter your contact number"
                    required
                  />
                </label>

                
<label>
  Email Address (optional)
  <input
    type="email"
    name="email"
    value={order.email}
    onChange={(event) =>
      setOrder((previous) => ({
        ...previous,
        email: event.target.value,
      }))
    }
    placeholder="you@example.com"
    maxLength={254}
  />
</label>


                {orderError && (
                  <p role="alert" className="api-error">
                    {orderError}
                  </p>
                )}

                <button
                  className="primary-btn"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Request →'}
                </button>

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setPage('home')}
                >
                  Cancel
                </button>
              </form>
            )}
          </section>
        )}

        
{/* SAFETY PAGE */}
{page === 'safety' && (
  <section className="page-content info-page safety-page">
    <p className="tagline">YOUR TRUST MATTERS</p>

    <h2>Safety at Every Step</h2>

    <p className="section-subtitle">
      We aim to make every pickup and delivery simple,
      reliable, secure and responsible.
    </p>

    <div className="info-card">
      <h3>Responsible Deliveries</h3>
      <p>
        Provide accurate pickup and delivery addresses
        and clear item details when placing a request
        to help ensure a smooth delivery experience.
      </p>
    </div>

    <div className="info-card">
      <h3>Protect Your Information</h3>
      <p>
        Share only the information needed to arrange
        your delivery. Never share your passwords,
        payment PINs or OTPs with anyone.
      </p>
    </div>

    <div className="info-card">
      <h3>Safe and Reliable Service</h3>
      <p>
        Verify your order details before confirming
        your request. If something seems suspicious,
        contact our support team for assistance.
      </p>
    </div>

    <div className="safety-contact">
      <h3>Need Help?</h3>

      <p>
        Contact our support team for assistance.
      </p>

      <a href="mailto:tech.kelsivo@gmail.com">
        ✉ tech.kelsivo@gmail.com
      </a>
    </div>

    <button
      className="primary-btn"
      onClick={() => setPage('booking')}
    >
      Book Delivery →
    </button>
  </section>
)}

{/* CAREERS PAGE */}
{page === 'careers' && (
  <section className="page-content info-page careers-page">
    <p className="tagline">GROW WITH KELSIVO</p>

    <h2>Careers at Kelsivo</h2>

    <p className="section-subtitle">
      Interested in building convenient local delivery
      services with us?
    </p>

    <div className="info-card">
      <h3>Join Our Network</h3>

      <p>
        We welcome interest from delivery partners,
        operations professionals and people who want
        to help us grow.
      </p>

      <p>
        Send us your profile and area of interest.
        We would love to hear from you!
      </p>

      <p className="careers-email-label">
        Career Enquiries
      </p>

      <a
        className="careers-email"
        href="mailto:tech.kelsivo@gmail.com?subject=Career%20Enquiry%20-%20Kelsivo"
      >
        ✉ tech.kelsivo@gmail.com
      </a>
    </div>
     <button
      className="primary-btn"
      onClick={() => setPage('booking')}
    >
      Book Delivery →
    </button>
  </section>
)}

{/* CONTACT US PAGE */}
{page === 'contact' && (
  <section className="page-content info-page contact-page">
    <p className="tagline">WE'RE HERE TO HELP</p>

    <h2>Contact Kelsivo</h2>

    <p className="section-subtitle">
      Need help with a pickup or delivery request?
      Get in touch with our team.
    </p>

    <div className="info-card">
      <h3>Customer Support</h3>

      <p>
        For delivery enquiries, include your order
        details and contact information when contacting
        our support team.
      </p>

      <div className="contact-detail">
        <strong>Business Email</strong>

        <a href="mailto:tech.kelsivo@gmail.com">
          ✉ tech.kelsivo@gmail.com
        </a>
      </div>

      <div className="contact-detail">
        <strong>Support Phone</strong>

        <p>
          Please contact us by email for assistance.
        </p>
      </div>
    </div>

    <button
      className="primary-btn"
      onClick={() => setPage('booking')}
    >
      Book Delivery →
    </button>
  </section>
)}
      


{/* TRACK MY ORDER PAGE */}
{page === 'tracking' && (
  <section className="tracking-page page-content">
    <div className="tracking-heading">
      <span className="tracking-eyebrow">
        KELSIVO ORDER TRACKING
      </span>

      <h2>Track Your Order</h2>

      <p>Check your latest order status.
      </p>
    </div>

    <div className="tracking-grid">
      <div className="tracking-card">
        <div className="tracking-card-icon">
          <PackageSearch size={28} strokeWidth={1.8} />
        </div>

        <h3 className="tracking-card-title">
          Find Your Booking
        </h3>

        <p className="tracking-card-description">
          Enter your Order ID and booking phone number.
        </p>

       
        <form onSubmit={handleTrackOrder}
          className="tracking-form"
          >
  <label>
    Order ID
    <input
      type="number"
      min="1"
      value={trackingId}
      onChange={(event) => setTrackingId(event.target.value)}
      placeholder="Enter your Order ID"
      required
    />
  </label>

  <label>
    Booking Phone Number
    <input
      type="tel"
      value={trackingPhone}
      onChange={(event) => setTrackingPhone(event.target.value)}
      placeholder="Enter your booking phone number"
      required
    />
  </label>

  {trackingError && (
    <p className="api-error" role="alert">
      {trackingError}
    </p>
  )}

      <button
        type="submit"
        className="tracking-submit"
         disabled={trackingLoading}
       >
          {trackingLoading ? 'Checking Order...' : 'Track My Order →'}
      </button>
    </form>


     
{trackingResult && (
  <div className="tracking-result-card">
    <div className="tracking-result-header">
      <div>
        <span className="tracking-result-label">
          ORDER DETAILS
        </span>
        <h3>Order #{trackingResult.id}</h3>
      </div>

      <span
        className={`tracking-status ${
          trackingResult.status?.toLowerCase().replace(/\s+/g, '-')
        }`}
      >
        {trackingResult.status}
      </span>
    </div>

    <div className="tracking-result-divider" />

    <div className="tracking-result-detail">
      <span>Service</span>
      <strong>{trackingResult.service}</strong>
    </div>

    <div className="tracking-result-detail">
      <span>Order Status</span>
      <strong>{trackingResult.status}</strong>
    </div>
    </div>
    )}

        <div className="tracking-secure-note">
  Your booking details are used only to find your order.
</div>
      </div>
    </div>
  </section>
)}




        {/* ADMIN PAGE */}
        {page === 'admin' && (
          <section className="order-section page-content">
            {!token ? (
              <>
                <p className="tagline">BUSINESS MANAGEMENT</p>
                <AdminLogin onLogin={handleAdminLogin} />
              </>
            ) : (
              <>
                <p className="tagline">BUSINESS MANAGEMENT</p>
                <h2>Admin Dashboard</h2>

                <p className="section-subtitle">
                  Manage your Kelsivo delivery requests.
                </p>

                <div className="admin-heading">
                  <p>
                    Signed in as {admin?.email || 'Administrator'}
                  </p>

                  <button
                    className="cancel-btn"
                    onClick={handleLogout}
                  >
                    Log Out
                  </button>
                </div>

                {apiError && (
                  <p role="alert" className="api-error">
                    {apiError}
                  </p>
                )}

                <div className="admin-stats">
                  <div className="stat-card">
                    <span>Total Orders</span>
                    <strong>{orders.length}</strong>
                  </div>

                  <div className="stat-card">
                    <span>New Requests</span>
                    <strong>
                      {orders.filter(
                        (item) => item.status === 'New Request'
                      ).length}
                    </strong>
                  </div>

                  <div className="stat-card">
                    <span>Completed</span>
                    <strong>
                      {orders.filter(
                        (item) => item.status === 'Completed'
                      ).length}
                    </strong>
                  </div>
                </div>

                <div className="admin-heading">
                  <h3>Customer Orders</h3>

                  <button
                    className="primary-btn"
                    onClick={() => {
                      setSuccess(false)
                      setOrderError('')
                      setPage('booking')
                    }}
                  >
                    + New Order
                  </button>
                </div>

                {loadingOrders ? (
                  <p>Loading orders from MySQL...</p>
                ) : orders.length === 0 ? (
                  <div className="success-message">
                    <h3>No orders yet</h3>
                    <p>
                      Customer requests submitted through the booking
                      form will appear here.
                    </p>

                    <button
                      className="primary-btn"
                      onClick={() => setPage('booking')}
                    >
                      Create Test Order →
                    </button>
                  </div>
                ) : (
                  <div className="orders-list">
                    {orders.map((item) => (
                      <article
                        className="admin-order"
                        key={item.id}
                      >
                        <div className="admin-order-top">
                          <div>
                            <span className="order-number">
                              ORDER #{item.id}
                            </span>

                            <h3>{item.service}</h3>
                            <p>{formatDate(item.createdAt)}</p>
                          </div>

                          <span className="status-badge">
                            {item.status}
                          </span>
                        </div>

                        <div className="order-details">
                          <p>
                            <strong>Pickup:</strong> {item.pickup}
                          </p>
                          <p>
                            <strong>Delivery:</strong> {item.delivery}
                          </p>
                          <p>
                            <strong>Item:</strong> {item.details}
                          </p>
                          <p>
                            <strong>Contact:</strong> {item.phone}
                          </p>
                          <p>
                            <strong>Email:</strong>  {item.email || 'Not provided'}
                          </p>  
                        </div>

                        <label className="status-label">
                          Update order status

                          <select
                            value={item.status}
                            disabled={updatingOrderId === item.id}
                            onChange={(event) =>
                              updateStatus(item.id, event.target.value)
                            }
                          >
                            {ORDER_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </label>

                        {updatingOrderId === item.id && (
                          <p>Saving status...</p>
                        )}

                        <button
                          className="cancel-btn"
                          onClick={() =>
                            setSelectedOrder(
                              selectedOrder === item.id
                                ? null
                                : item.id
                            )
                          }
                        >
                          {selectedOrder === item.id
                            ? 'Hide Details'
                            : 'View Details'}
                        </button>

                        {selectedOrder === item.id && (
                          <div className="extra-details">
                            <p>Full order ID: {item.id}</p>
                            <p>
                              Created: {formatDate(item.createdAt)}
                            </p>
                            <p>Status: {item.status}</p>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>

      <footer>
        <p>
          © {new Date().getFullYear()} Kelsivo.
          Made for your neighbourhood.
        </p>
      </footer>
    </div>
  )
}

export default App
