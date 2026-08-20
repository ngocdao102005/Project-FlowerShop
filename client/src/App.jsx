import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Boxes,
  Check,
  ChevronDown,
  CircleUserRound,
  Clock3,
  CreditCard,
  Edit3,
  FileText,
  Flower2,
  Gift,
  Heart,
  LayoutDashboard,
  Leaf,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquareText,
  Minus,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Trash2,
  Truck,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { api, hasToken, setToken } from './api'

const CART_KEY = 'flowery_guest_cart'
const WISHLIST_KEY = 'flowery_guest_wishlist'
const BACKOFFICE_ROLES = new Set(['staff', 'editor', 'admin'])

const money = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(Number(value || 0))

const formatDate = (value) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(`${value}${String(value).includes('Z') ? '' : 'Z'}`))

const orderLabels = {
  Confirmed: 'Đã xác nhận',
  Preparing: 'Đang chuẩn bị',
  Shipping: 'Đang giao',
  Delivered: 'Đã giao',
  Cancelled: 'Đã hủy',
}

const paymentLabels = {
  Pending: 'Chờ thanh toán',
  Paid: 'Đã thanh toán',
  Failed: 'Thanh toán lỗi',
  Refunded: 'Đã hoàn tiền',
}

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback
  } catch {
    return fallback
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Không thể đọc tệp đã chọn.'))
    reader.readAsDataURL(file)
  })
}

async function createAvatarDataUrl(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Vui lòng chọn tệp ảnh.')
  if (file.size > 3 * 1024 * 1024) throw new Error('Ảnh đại diện không được vượt quá 3 MB.')
  const source = await fileToDataUrl(file)
  const image = await new Promise((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('Tệp ảnh không hợp lệ.'))
    element.src = source
  })
  const side = Math.min(image.naturalWidth, image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  canvas.getContext('2d').drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    256,
    256,
  )
  return canvas.toDataURL('image/jpeg', 0.82)
}

function StatusBadge({ status }) {
  return <span className={`status status--${String(status).toLowerCase()}`}>
    {orderLabels[status] || paymentLabels[status] || status}
  </span>
}

function Toast({ toast, onClose }) {
  if (!toast) return null
  return (
    <div className={`toast toast--${toast.type || 'success'}`} role="status">
      <span>{toast.type === 'error' ? <X size={17} /> : <Check size={17} />}</span>
      <p>{toast.message}</p>
      <button type="button" onClick={onClose} aria-label="Đóng thông báo"><X size={16} /></button>
    </div>
  )
}

function Loading({ label = 'Đang chuẩn bị những đóa hoa đẹp nhất...' }) {
  return <div className="loading"><RefreshCw size={22} className="spin" /><span>{label}</span></div>
}

function EmptyState({ icon: Icon = Flower2, title, text, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon"><Icon /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

function Header({ user, view, cartCount, wishlistCount, search, onSearch, navigate, onLogout }) {
  const [open, setOpen] = useState(false)
  const go = (next) => {
    setOpen(false)
    navigate(next)
  }
  return (
    <>
      <div className="announcement">Giao nhanh nội thành trong 2 giờ · Miễn phí thiệp viết tay</div>
      <header className="site-header">
        <div className="shell header-row">
          <button type="button" className="brand" onClick={() => go('home')} aria-label="Về trang chủ">
            <span className="brand__mark"><Flower2 /></span>
            <span><b>Flowery</b><small>Trao hoa, gửi thương</small></span>
          </button>
          <nav className={`main-nav ${open ? 'main-nav--open' : ''}`} aria-label="Điều hướng chính">
            <button className={view === 'home' ? 'active' : ''} onClick={() => go('home')}>Cửa hàng</button>
            <button className={view === 'orders' ? 'active' : ''} onClick={() => go(user ? 'orders' : 'auth')}>Đơn hàng</button>
            <a href="#journal" onClick={() => setOpen(false)}>Cẩm nang hoa</a>
            {BACKOFFICE_ROLES.has(user?.role) && (
              <button className={view === 'admin' ? 'active' : ''} onClick={() => go('admin')}>
                Vận hành
              </button>
            )}
          </nav>
          <div className="header-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              onFocus={() => view !== 'home' && navigate('home')}
              placeholder="Tìm hoa theo dịp, màu sắc..."
              aria-label="Tìm sản phẩm"
            />
          </div>
          <div className="header-actions">
            <button type="button" className="icon-button counter" onClick={() => go('wishlist')} aria-label="Yêu thích">
              <Heart size={21} />
              {wishlistCount > 0 && <span>{wishlistCount}</span>}
            </button>
            <button type="button" className="icon-button counter" onClick={() => go('cart')} aria-label="Giỏ hàng">
              <ShoppingBag size={21} />
              {cartCount > 0 && <span>{cartCount}</span>}
            </button>
            {user ? (
              <div className="account-menu">
                <button type="button" className="account-button" onClick={() => go('account')}>
                  <CircleUserRound size={22} />
                  <span><small>Xin chào</small><b>{user.full_name.split(' ').at(-1)}</b></span>
                  <ChevronDown size={15} />
                </button>
                <button type="button" className="logout-button" onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất">
                  <LogOut size={18} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            ) : (
              <button type="button" className="button button--small button--outline" onClick={() => go('auth')}>
                Đăng nhập
              </button>
            )}
            <button type="button" className="menu-toggle" onClick={() => setOpen(!open)} aria-label="Mở menu">
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
    </>
  )
}

function ProductCard({ product, wished, onWish, onSelect, onAdd }) {
  return (
    <article className="product-card">
      <div className="product-card__media">
        <button type="button" className="product-card__image" onClick={() => onSelect(product.product_id)}>
          <img src={product.image_url} alt={product.name} loading="lazy" />
        </button>
        <span className="product-card__occasion">{product.occasion}</span>
        <button
          type="button"
          className={`wish-button ${wished ? 'wish-button--active' : ''}`}
          onClick={() => onWish(product)}
          aria-label={wished ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
        >
          <Heart size={19} fill={wished ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="product-card__body">
        <div className="eyebrow">{product.category_name} · {product.color}</div>
        <button type="button" className="product-card__name" onClick={() => onSelect(product.product_id)}>
          {product.name}
        </button>
        <div className="rating-line">
          <Star size={14} fill="currentColor" />
          <span>{product.average_rating || 'Mới'}</span>
          <small>{product.review_count ? `(${product.review_count} đánh giá)` : 'Thiết kế mới'}</small>
        </div>
        <div className="product-card__footer">
          <strong>{money(product.price)}</strong>
          <button type="button" onClick={() => onAdd(product)} aria-label={`Thêm ${product.name} vào giỏ`}>
            <Plus size={18} />
          </button>
        </div>
      </div>
    </article>
  )
}

function HomeView({
  products,
  categories,
  catalogMeta,
  articles,
  filters,
  setFilters,
  loading,
  wishlistIds,
  onWish,
  onSelect,
  onAdd,
}) {
  return (
    <main>
      <section className="hero shell">
        <div className="hero__copy">
          <div className="kicker"><Sparkles size={16} /> Bộ sưu tập mùa yêu thương</div>
          <h1>Mỗi đóa hoa,<br /><em>một lời muốn nói.</em></h1>
          <p>Hoa tươi được thiết kế bởi nghệ nhân, chuẩn bị theo đơn và giao tận tay người bạn thương.</p>
          <div className="hero__actions">
            <a className="button button--primary" href="#collection">Khám phá bộ sưu tập <ArrowRight size={18} /></a>
            <div className="hero__proof">
              <span>4.9</span>
              <div><div className="stars">★★★★★</div><small>Từ khách hàng Flowery</small></div>
            </div>
          </div>
        </div>
        <div className="hero__visual">
          <div className="hero__arch">
            <img src="/api/media/nang-tho-lavender.svg" alt="Bó hoa Nàng thơ Lavender" />
          </div>
          <span className="botanical botanical--one"><Leaf /></span>
          <span className="botanical botanical--two"><Leaf /></span>
          <div className="hero__note"><Flower2 /><span><b>Thiết kế trong ngày</b><small>Mỗi bó hoa là một phiên bản riêng</small></span></div>
        </div>
      </section>

      <section className="benefits">
        <div className="shell benefits__grid">
          <div><span><Flower2 /></span><b>Hoa tươi tuyển chọn</b><small>Nhập mới mỗi sáng</small></div>
          <div><span><Truck /></span><b>Giao đúng khoảnh khắc</b><small>Theo dõi trạng thái trực tuyến</small></div>
          <div><span><ShieldCheck /></span><b>Thanh toán an toàn</b><small>Không lưu thông tin thẻ</small></div>
          <div><span><Gift /></span><b>Gói quà tinh tế</b><small>Kèm thiệp viết tay</small></div>
        </div>
      </section>

      <section className="collection shell" id="collection">
        <div className="section-heading">
          <div><span className="eyebrow">Được yêu thích</span><h2>Hoa cho mọi dịp</h2></div>
          <p>Tìm thiết kế phù hợp theo câu chuyện, sắc màu và ngân sách của bạn.</p>
        </div>
        <div className="category-pills">
          <button
            type="button"
            className={!filters.category ? 'active' : ''}
            onClick={() => setFilters((current) => ({ ...current, category: '' }))}
          >Tất cả</button>
          {categories.map((category) => (
            <button
              type="button"
              key={category.category_id}
              className={filters.category === category.slug ? 'active' : ''}
              onClick={() => setFilters((current) => ({ ...current, category: category.slug }))}
            >
              {category.name}<small>{category.product_count}</small>
            </button>
          ))}
        </div>
        <div className="catalog-toolbar">
          <div className="filter-group">
            <select
              value={filters.occasion}
              onChange={(event) => setFilters((current) => ({ ...current, occasion: event.target.value }))}
              aria-label="Lọc theo dịp"
            >
              <option value="">Mọi dịp</option>
              {catalogMeta.occasions?.map((occasion) => <option key={occasion}>{occasion}</option>)}
            </select>
            <select
              value={filters.color}
              onChange={(event) => setFilters((current) => ({ ...current, color: event.target.value }))}
              aria-label="Lọc theo màu"
            >
              <option value="">Mọi màu sắc</option>
              {catalogMeta.colors?.map((color) => <option key={color}>{color}</option>)}
            </select>
          </div>
          <select
            value={filters.sort}
            onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}
            aria-label="Sắp xếp sản phẩm"
          >
            <option value="featured">Nổi bật</option>
            <option value="price_asc">Giá thấp đến cao</option>
            <option value="price_desc">Giá cao đến thấp</option>
            <option value="rating">Đánh giá cao</option>
            <option value="name">Tên A–Z</option>
          </select>
        </div>
        {loading ? <Loading /> : products.length === 0 ? (
          <EmptyState title="Chưa tìm thấy mẫu hoa" text="Hãy thử bỏ bớt bộ lọc hoặc dùng một từ khóa khác." />
        ) : (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard
                key={product.product_id}
                product={product}
                wished={wishlistIds.includes(product.product_id)}
                onWish={onWish}
                onSelect={onSelect}
                onAdd={onAdd}
              />
            ))}
          </div>
        )}
      </section>

      <section className="story-section" id="journal">
        <div className="shell">
          <div className="section-heading section-heading--light">
            <div><span className="eyebrow">Flowery Journal</span><h2>Cẩm nang trao hoa</h2></div>
            <p>Chọn hoa đúng ý và giữ khoảnh khắc đẹp lâu hơn.</p>
          </div>
          <div className="journal-grid">
            {articles.map((article, index) => (
              <article key={article.article_id}>
                <span>0{index + 1}</span>
                <div><h3>{article.title}</h3><p>{article.summary}</p></div>
                <ArrowRight />
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function ProductDetailView({ productId, user, wished, onBack, onWish, onAdd, onSelect, onLogin, notify }) {
  const [data, setData] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [review, setReview] = useState({ rating: 5, comment: '' })
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setData(null)
    try {
      setData(await api.get(`/products/${productId}`))
    } catch (error) {
      notify(error.message, 'error')
    }
  }, [productId, notify])

  useEffect(() => { load() }, [load])
  if (!data) return <main className="shell page"><Loading /></main>
  const { item, reviews, related } = data

  const submitReview = async (event) => {
    event.preventDefault()
    if (!user) return onLogin()
    setSubmitting(true)
    try {
      const response = await api.post(`/products/${item.product_id}/reviews`, review)
      setReview({ rating: 5, comment: '' })
      notify(response.message)
      await load()
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="shell page">
      <button type="button" className="back-button" onClick={onBack}><ArrowLeft size={18} /> Quay lại cửa hàng</button>
      <section className="product-detail">
        <div className="product-detail__media"><img src={item.image_url} alt={item.name} /></div>
        <div className="product-detail__content">
          <div className="eyebrow">{item.category_name} · {item.occasion}</div>
          <h1>{item.name}</h1>
          <div className="rating-line rating-line--large">
            <Star size={17} fill="currentColor" />
            <b>{item.average_rating || 'Mới'}</b>
            <span>{item.review_count ? `${item.review_count} đánh giá` : 'Chưa có đánh giá'}</span>
          </div>
          <div className="detail-price">{money(item.price)}</div>
          <p className="detail-description">{item.description}</p>
          <dl className="detail-facts">
            <div><dt>Loại hoa</dt><dd>{item.flower_type}</dd></div>
            <div><dt>Màu chủ đạo</dt><dd>{item.color}</dd></div>
            <div><dt>Tình trạng</dt><dd>{item.stock_quantity > 0 ? `Còn ${item.stock_quantity} sản phẩm` : 'Tạm hết hàng'}</dd></div>
          </dl>
          <div className="editor-note">
            <Sparkles size={20} />
            <div><b>Góc nghệ nhân</b><p>{item.editorial_review}</p></div>
          </div>
          <div className="detail-actions">
            <div className="quantity">
              <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={17} /></button>
              <span>{quantity}</span>
              <button type="button" onClick={() => setQuantity(Math.min(item.stock_quantity, quantity + 1))}><Plus size={17} /></button>
            </div>
            <button
              type="button"
              className="button button--primary button--grow"
              disabled={item.stock_quantity === 0}
              onClick={() => onAdd(item, quantity)}
            >
              <ShoppingBag size={18} /> Thêm vào giỏ
            </button>
            <button type="button" className={`icon-button icon-button--large ${wished ? 'active' : ''}`} onClick={() => onWish(item)}>
              <Heart fill={wished ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </section>

      <section className="reviews-section">
        <div>
          <span className="eyebrow">Khách hàng nói gì</span>
          <h2>Đánh giá sản phẩm</h2>
          {reviews.length === 0 ? <p className="muted">Chưa có đánh giá được duyệt.</p> : (
            <div className="review-list">
              {reviews.map((entry) => (
                <article key={entry.review_id}>
                  <div><b>{entry.full_name}</b><span>{'★'.repeat(entry.rating)}{'☆'.repeat(5 - entry.rating)}</span></div>
                  <p>{entry.comment}</p><small>{formatDate(entry.created_at)}</small>
                </article>
              ))}
            </div>
          )}
        </div>
        <form className="review-form" onSubmit={submitReview}>
          <h3>Chia sẻ trải nghiệm</h3>
          <p>Đánh giá sẽ được kiểm duyệt trước khi hiển thị.</p>
          <label>Số sao
            <select value={review.rating} onChange={(event) => setReview({ ...review, rating: Number(event.target.value) })}>
              {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} sao</option>)}
            </select>
          </label>
          <label>Nội dung
            <textarea
              value={review.comment}
              onChange={(event) => setReview({ ...review, comment: event.target.value })}
              placeholder="Bó hoa và trải nghiệm giao hàng của bạn thế nào?"
              required
              minLength={5}
            />
          </label>
          <button className="button button--dark" disabled={submitting}>
            {user ? 'Gửi đánh giá' : 'Đăng nhập để đánh giá'}
          </button>
        </form>
      </section>

      {related.length > 0 && (
        <section className="related-section">
          <div className="section-heading"><div><span className="eyebrow">Có thể bạn sẽ thích</span><h2>Thiết kế liên quan</h2></div></div>
          <div className="product-grid product-grid--four">
            {related.map((product) => (
              <ProductCard
                key={product.product_id}
                product={product}
                wished={false}
                onWish={onWish}
                onSelect={onSelect}
                onAdd={onAdd}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function AuthView({ onAuthenticated, notify }) {
  const [mode, setMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone_number: '',
    address: '',
  })

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const payload = await api.post(`/auth/${mode}`, form)
      await onAuthenticated(payload)
      notify(mode === 'login' ? 'Đăng nhập thành công.' : 'Tài khoản đã được tạo.')
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-aside">
        <span className="brand__mark brand__mark--large"><Flower2 /></span>
        <span className="eyebrow">Chào mừng đến Flowery</span>
        <h1>Những điều chân thành luôn xứng đáng được trao thật đẹp.</h1>
        <p>Đăng nhập để lưu giỏ hàng, theo dõi giao hàng và gửi đánh giá sau khi nhận hoa.</p>
        <div className="demo-card"><b>Bảo mật tài khoản</b><span>Không chia sẻ mật khẩu hoặc mã phiên đăng nhập. Flowery không bao giờ yêu cầu mật khẩu qua tin nhắn.</span></div>
      </section>
      <section className="auth-card">
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Đăng nhập</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Tạo tài khoản</button>
        </div>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label>Họ và tên<input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
              <div className="form-grid">
                <label>Số điện thoại<input required value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} /></label>
                <label>Địa chỉ<input required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
              </div>
            </>
          )}
          <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Mật khẩu<input required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          <button className="button button--primary button--full" disabled={busy}>
            {busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            {!busy && <ArrowRight size={18} />}
          </button>
          <p className="form-note"><LockKeyhole size={15} /> Mật khẩu được băm bằng scrypt, không lưu dạng văn bản.</p>
        </form>
      </section>
    </main>
  )
}

function CartView({ cart, user, onQuantity, onRemove, onCheckout, onContinue, notify }) {
  const [giftWrap, setGiftWrap] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    customer_name: user?.full_name || '',
    customer_phone: user?.phone_number || '',
    shipping_address: user?.address || '',
    gift_message: user?.default_message || '',
    payment_method: 'COD',
  })
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const total = subtotal + (giftWrap ? 50000 : 0)

  const submit = async (event) => {
    event.preventDefault()
    if (!user) return onCheckout(null)
    setBusy(true)
    try {
      await onCheckout({
        ...form,
        gift_wrap: giftWrap,
        items: cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
        idempotency_key: crypto.randomUUID(),
      })
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (cart.length === 0) {
    return (
      <main className="shell page">
        <EmptyState
          icon={ShoppingBag}
          title="Giỏ hoa đang trống"
          text="Hãy chọn một thiết kế để bắt đầu gửi lời yêu thương."
          action={<button className="button button--primary" onClick={onContinue}>Khám phá hoa</button>}
        />
      </main>
    )
  }

  return (
    <main className="shell page">
      <div className="page-heading"><div><span className="eyebrow">Đơn hàng của bạn</span><h1>Giỏ hoa</h1></div><button className="text-button" onClick={onContinue}>Tiếp tục mua</button></div>
      <div className="checkout-layout">
        <section className="cart-list">
          {cart.map((item) => (
            <article className="cart-item" key={item.product_id}>
              <img src={item.image_url} alt={item.name} />
              <div className="cart-item__info"><span className="eyebrow">{item.occasion}</span><h3>{item.name}</h3><strong>{money(item.price)}</strong></div>
              <div className="quantity">
                <button type="button" onClick={() => onQuantity(item, Math.max(1, item.quantity - 1))}><Minus size={16} /></button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => onQuantity(item, item.quantity + 1)}><Plus size={16} /></button>
              </div>
              <b className="cart-item__total">{money(item.price * item.quantity)}</b>
              <button type="button" className="delete-button" onClick={() => onRemove(item)}><Trash2 size={18} /></button>
            </article>
          ))}
          <label className="gift-option">
            <input type="checkbox" checked={giftWrap} onChange={(event) => setGiftWrap(event.target.checked)} />
            <span><Gift /><b>Gói quà đặc biệt</b><small>Giấy gói cao cấp, nơ lụa và thiệp viết tay</small></span>
            <strong>+{money(50000)}</strong>
          </label>
        </section>
        <form className="checkout-card" onSubmit={submit}>
          <h2>Thông tin giao hoa</h2>
          <div className="form-grid">
            <label>Người nhận<input required value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} /></label>
            <label>Số điện thoại<input required value={form.customer_phone} onChange={(event) => setForm({ ...form, customer_phone: event.target.value })} /></label>
          </div>
          <label>Địa chỉ giao<input required value={form.shipping_address} onChange={(event) => setForm({ ...form, shipping_address: event.target.value })} /></label>
          <label>Lời nhắn<textarea value={form.gift_message} onChange={(event) => setForm({ ...form, gift_message: event.target.value })} placeholder="Điều bạn muốn gửi đến người nhận..." /></label>
          <fieldset className="payment-options">
            <legend>Phương thức thanh toán</legend>
            {[
              ['COD', 'Thanh toán khi nhận', Truck],
              ['CARD', 'Thẻ (sandbox)', CreditCard],
              ['MOMO', 'Ví điện tử (sandbox)', BadgeDollarSign],
            ].map(([value, label, Icon]) => (
              <label key={value} className={form.payment_method === value ? 'active' : ''}>
                <input type="radio" name="payment" value={value} checked={form.payment_method === value} onChange={(event) => setForm({ ...form, payment_method: event.target.value })} />
                <Icon size={19} /><span>{label}</span>
              </label>
            ))}
          </fieldset>
          <div className="summary-lines">
            <div><span>Tạm tính</span><b>{money(subtotal)}</b></div>
            <div><span>Gói quà</span><b>{giftWrap ? money(50000) : '—'}</b></div>
            <div className="summary-total"><span>Tổng cộng</span><strong>{money(total)}</strong></div>
          </div>
          <button
            type={user ? 'submit' : 'button'}
            className="button button--primary button--full"
            disabled={busy}
            onClick={user ? undefined : () => onCheckout(null)}
          >
            {busy ? 'Đang tạo đơn...' : user ? 'Xác nhận đặt hoa' : 'Đăng nhập để đặt hoa'}
          </button>
          <p className="form-note"><ShieldCheck size={15} /> Giá và tồn kho được kiểm tra lại an toàn trên máy chủ.</p>
        </form>
      </div>
    </main>
  )
}

function OrdersView({ notify }) {
  const [orders, setOrders] = useState(null)
  const [cancelOrder, setCancelOrder] = useState(null)
  const [cancelReason, setCancelReason] = useState('Khách hàng đổi nhu cầu')
  const [cancelBusy, setCancelBusy] = useState(false)
  const [refundOrder, setRefundOrder] = useState(null)
  const [refundForm, setRefundForm] = useState({ reason: '', evidence_url: '' })
  const [refundBusy, setRefundBusy] = useState(false)
  const load = useCallback(async () => {
    try {
      const response = await api.get('/orders/mine')
      setOrders(response.items)
    } catch (error) {
      notify(error.message, 'error')
    }
  }, [notify])
  useEffect(() => { load() }, [load])

  const openCancel = (order) => {
    setCancelOrder(order)
    setCancelReason('Khách hàng đổi nhu cầu')
  }

  const cancel = async (event) => {
    event.preventDefault()
    if (!cancelOrder) return
    setCancelBusy(true)
    try {
      await api.post(`/orders/${cancelOrder.order_id}/cancel`, { reason: cancelReason.trim() || 'Khách hàng yêu cầu hủy' })
      notify('Đơn đã được hủy và tồn kho đã được hoàn lại.')
      setCancelOrder(null)
      load()
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setCancelBusy(false)
    }
  }

  const openRefund = (order) => {
    setRefundOrder(order)
    setRefundForm({ reason: '', evidence_url: '' })
  }

  const requestRefund = async (event) => {
    event.preventDefault()
    if (!refundOrder || refundForm.reason.trim().length < 10) {
      notify('Vui lòng mô tả lý do hoàn tiền ít nhất 10 ký tự.', 'error')
      return
    }
    setRefundBusy(true)
    try {
      await api.post(`/orders/${refundOrder.order_id}/refunds`, refundForm)
      notify('Yêu cầu hoàn tiền đã được tiếp nhận.')
      setRefundOrder(null)
      load()
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setRefundBusy(false)
    }
  }

  if (!orders) return <main className="shell page"><Loading label="Đang tải hành trình đơn hoa..." /></main>
  return (
    <main className="shell page">
      <div className="page-heading"><div><span className="eyebrow">Theo dõi từng khoảnh khắc</span><h1>Đơn hàng của tôi</h1></div></div>
      {orders.length === 0 ? <EmptyState icon={PackageCheck} title="Chưa có đơn hàng" text="Đơn đầu tiên của bạn sẽ xuất hiện tại đây." /> : (
        <div className="order-list">
          {orders.map((order) => (
            <article className="order-card" key={order.order_id}>
              <header>
                <div><small>Mã đơn</small><b>{order.order_number}</b></div>
                <div><small>Đặt lúc</small><span>{formatDate(order.created_at)}</span></div>
                <StatusBadge status={order.status} />
              </header>
              <div className="order-card__body">
                <div className="order-items">
                  {order.items.map((item) => (
                    <div key={item.order_item_id}><span>{item.quantity} × {item.product_name}</span><b>{money(item.line_total)}</b></div>
                  ))}
                </div>
                <div className="shipment-box">
                  <Truck size={21} />
                  <div><small>{order.carrier}</small><b>{order.tracking_code}</b><span>{orderLabels[order.shipment_status] || order.shipment_status}</span></div>
                </div>
              </div>
              <footer>
                <div><span>Thanh toán</span><StatusBadge status={order.payment_status} /></div>
                <strong>{money(order.total_amount)}</strong>
                <div className="order-actions">
                  {['Confirmed', 'Preparing'].includes(order.status) && <button className="button button--danger button--small" onClick={() => openCancel(order)}>Hủy đơn</button>}
                  {order.status === 'Delivered' && !order.refund_id && <button className="button button--outline button--small" onClick={() => openRefund(order)}>Yêu cầu hoàn tiền</button>}
                  {order.refund_status && <span className="muted">Hoàn tiền: {order.refund_status}</span>}
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
      {cancelOrder && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !cancelBusy && setCancelOrder(null)}>
          <form className="modal-card" onSubmit={cancel} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-card__heading">
              <div><span className="eyebrow">Đơn {cancelOrder.order_number}</span><h2>Xác nhận hủy đơn</h2></div>
              <button type="button" className="icon-button" onClick={() => setCancelOrder(null)} aria-label="Đóng"><X size={18} /></button>
            </div>
            <p className="muted">Tồn kho sẽ được hoàn lại. Nếu đơn đã thanh toán, hệ thống tạo hoàn tiền tự động.</p>
            <label>Lý do hủy
              <textarea maxLength={300} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Nhập lý do để lưu lịch sử xử lý" />
              <small>{cancelReason.length} / 300 ký tự</small>
            </label>
            <div className="modal-card__actions">
              <button type="button" className="button button--outline" onClick={() => setCancelOrder(null)}>Giữ đơn hàng</button>
              <button className="button button--danger" disabled={cancelBusy}>{cancelBusy ? 'Đang hủy...' : 'Xác nhận hủy đơn'}</button>
            </div>
          </form>
        </div>
      )}
      {refundOrder && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !refundBusy && setRefundOrder(null)}>
          <form className="modal-card" onSubmit={requestRefund} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-card__heading">
              <div><span className="eyebrow">Đơn {refundOrder.order_number}</span><h2>Yêu cầu hoàn tiền</h2></div>
              <button type="button" className="icon-button" onClick={() => setRefundOrder(null)} aria-label="Đóng"><X size={18} /></button>
            </div>
            <p className="muted">Đơn đã giao · Số tiền yêu cầu: <b>{money(refundOrder.total_amount)}</b></p>
            <label>Lý do hoàn tiền *
              <textarea required minLength={10} maxLength={500} value={refundForm.reason} onChange={(event) => setRefundForm({ ...refundForm, reason: event.target.value })} placeholder="Mô tả vấn đề ít nhất 10 ký tự" />
              <small>{refundForm.reason.length} / 500 ký tự</small>
            </label>
            <label>Liên kết bằng chứng
              <input type="url" maxLength={500} value={refundForm.evidence_url} onChange={(event) => setRefundForm({ ...refundForm, evidence_url: event.target.value })} placeholder="https://... (không bắt buộc)" />
            </label>
            <div className="modal-card__actions">
              <button type="button" className="button button--outline" onClick={() => setRefundOrder(null)}>Hủy</button>
              <button className="button button--primary" disabled={refundBusy || refundForm.reason.trim().length < 10}>{refundBusy ? 'Đang gửi...' : 'Gửi yêu cầu'}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

function AccountView({ user, onUpdated, notify }) {
  const [form, setForm] = useState({
    full_name: user.full_name,
    phone_number: user.phone_number,
    address: user.address,
    default_message: user.default_message,
    avatar_url: user.avatar_url || '',
  })
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirmation: '' })
  const [avatarBusy, setAvatarBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    try {
      const response = await api.patch('/me', form)
      onUpdated(response.user)
      notify('Hồ sơ đã được cập nhật.')
    } catch (error) {
      notify(error.message, 'error')
    }
  }
  const chooseAvatar = async (event) => {
    const [file] = event.target.files
    if (!file) return
    setAvatarBusy(true)
    try {
      const avatar_url = await createAvatarDataUrl(file)
      setForm((current) => ({ ...current, avatar_url }))
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setAvatarBusy(false)
      event.target.value = ''
    }
  }
  const changePassword = async (event) => {
    event.preventDefault()
    if (passwordForm.new_password !== passwordForm.confirmation) {
      notify('Mật khẩu xác nhận không khớp.', 'error')
      return
    }
    try {
      const response = await api.patch('/me/password', passwordForm)
      onUpdated(response.user)
      setPasswordForm({ current_password: '', new_password: '', confirmation: '' })
      notify('Mật khẩu đã được thay đổi. Các phiên cũ không còn hiệu lực.')
    } catch (error) {
      notify(error.message, 'error')
    }
  }
  return (
    <main className="shell page profile-page">
      <aside className="profile-summary">
        <span className={`profile-avatar ${form.avatar_url ? 'profile-avatar--image' : ''}`}>
          {form.avatar_url
            ? <img src={form.avatar_url} alt={`Ảnh đại diện của ${user.full_name}`} />
            : user.full_name.split(' ').map((word) => word[0]).slice(-2).join('')}
        </span>
        <h2>{user.full_name}</h2><p>{user.email}</p>
        <StatusBadge status={user.role} />
        <div><ShieldCheck /><span><b>Tài khoản được bảo vệ</b><small>Phiên đăng nhập có chữ ký và thời hạn</small></span></div>
      </aside>
      <div className="profile-forms">
        {user.must_change_password ? <div className="form-alert"><LockKeyhole size={18} />Bạn đang dùng mật khẩu tạm. Hãy đổi mật khẩu trước khi tiếp tục.</div> : null}
        <form className="profile-form" onSubmit={submit}>
          <span className="eyebrow">Thông tin nhận hoa</span><h1>Hồ sơ của bạn</h1>
          <label>Ảnh đại diện
            <span className="file-control"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} disabled={avatarBusy} /><Upload size={17} />{avatarBusy ? 'Đang xử lý ảnh...' : 'Chọn ảnh (tối đa 3 MB)'}</span>
          </label>
          <label>Họ và tên<input required minLength="2" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
          <div className="form-grid">
            <label>Email<input value={user.email} disabled /></label>
            <label>Số điện thoại<input inputMode="tel" placeholder="09xxxxxxxx" value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} /></label>
          </div>
          <label>Địa chỉ mặc định<input maxLength="300" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
          <label>Lời chúc mặc định<textarea maxLength="500" value={form.default_message} onChange={(event) => setForm({ ...form, default_message: event.target.value })} /></label>
          <button className="button button--primary">Lưu thay đổi</button>
        </form>
        <form className="profile-form profile-form--security" onSubmit={changePassword}>
          <span className="eyebrow">Bảo mật</span><h2>Đổi mật khẩu</h2>
          <label>Mật khẩu hiện tại<input required type="password" autoComplete="current-password" value={passwordForm.current_password} onChange={(event) => setPasswordForm({ ...passwordForm, current_password: event.target.value })} /></label>
          <div className="form-grid">
            <label>Mật khẩu mới<input required minLength="10" type="password" autoComplete="new-password" value={passwordForm.new_password} onChange={(event) => setPasswordForm({ ...passwordForm, new_password: event.target.value })} /></label>
            <label>Nhập lại mật khẩu<input required minLength="10" type="password" autoComplete="new-password" value={passwordForm.confirmation} onChange={(event) => setPasswordForm({ ...passwordForm, confirmation: event.target.value })} /></label>
          </div>
          <small>Mật khẩu cần ít nhất 10 ký tự và nên có chữ hoa, chữ thường, số, ký tự đặc biệt.</small>
          <button className="button button--outline"><LockKeyhole size={17} />Đổi mật khẩu</button>
        </form>
      </div>
    </main>
  )
}

function AdminView({ user, notify, onLogout }) {
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingArticle, setEditingArticle] = useState(null)
  const canOperate = ['staff', 'admin'].includes(user.role)
  const canEditContent = ['editor', 'admin'].includes(user.role)
  const isAdmin = user.role === 'admin'
  const blankProduct = {
    name: '', slug: '', category_id: '', price: 450000, description: '',
    occasion: 'Sinh nhật', flower_type: 'Hoa hồng', color: 'Hồng',
    stock_quantity: 10, editorial_review: '', image_url: '', active: true,
  }
  const [productForm, setProductForm] = useState(blankProduct)
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })
  const blankArticle = { title: '', slug: '', summary: '', content: '', status: 'Draft', product_ids: [] }
  const [articleForm, setArticleForm] = useState(blankArticle)
  const [userForm, setUserForm] = useState({ full_name: '', email: '', role: 'staff', password: '' })

  const load = useCallback(async () => {
    try {
      const next = { stats: {}, products: [], categories: [], orders: [], reviews: [], users: [], refunds: [], articles: [] }
      const requests = [['stats', '/admin/stats', 'stats']]
      if (canOperate) requests.push(
        ['products', '/admin/products', 'items'],
        ['categories', '/admin/categories', 'items'],
        ['orders', '/admin/orders', 'items'],
        ['reviews', '/admin/reviews', 'items'],
        ['refunds', '/admin/refunds', 'items'],
      )
      if (canEditContent && !canOperate) requests.push(['products', '/products?limit=100', 'items'])
      if (canEditContent) requests.push(['articles', '/admin/articles', 'items'])
      if (isAdmin) requests.push(['users', '/admin/users', 'items'])
      const responses = await Promise.all(requests.map(([, path]) => api.get(path)))
      responses.forEach((response, index) => {
        const [key, , responseKey] = requests[index]
        next[key] = response[responseKey]
      })
      setData(next)
    } catch (error) {
      notify(error.message, 'error')
    }
  }, [canEditContent, canOperate, isAdmin, notify])
  useEffect(() => { load() }, [load])

  const submitProduct = async (event) => {
    event.preventDefault()
    try {
      if (editing) await api.put(`/admin/products/${editing}`, productForm)
      else await api.post('/admin/products', productForm)
      notify(editing ? 'Sản phẩm đã được cập nhật.' : 'Sản phẩm mới đã được tạo.')
      setEditing(null)
      setProductForm(blankProduct)
      load()
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const editProduct = (product) => {
    setEditing(product.product_id)
    setProductForm({ ...product, active: Boolean(product.active) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const archiveProduct = async (product) => {
    if (!window.confirm(`Ngừng kinh doanh "${product.name}"?`)) return
    try {
      await api.delete(`/admin/products/${product.product_id}`)
      notify('Sản phẩm đã được lưu trữ.')
      load()
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const addCategory = async (event) => {
    event.preventDefault()
    try {
      if (editingCategory) await api.put(`/admin/categories/${editingCategory}`, categoryForm)
      else await api.post('/admin/categories', categoryForm)
      setCategoryForm({ name: '', description: '' })
      setEditingCategory(null)
      notify(editingCategory ? 'Danh mục đã được cập nhật.' : 'Danh mục đã được tạo.')
      load()
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const editCategory = (category) => {
    setEditingCategory(category.category_id)
    setCategoryForm({ name: category.name, description: category.description || '', active: Boolean(category.active) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const archiveCategory = async (category) => {
    if (!window.confirm(`Ngừng sử dụng danh mục "${category.name}"?`)) return
    try {
      await api.delete(`/admin/categories/${category.category_id}`)
      notify('Danh mục đã ngừng sử dụng.')
      load()
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const reactivateCategory = async (category) => {
    try {
      await api.put(`/admin/categories/${category.category_id}`, { active: true })
      notify('Danh mục đã được kích hoạt lại.')
      load()
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const submitArticle = async (event) => {
    event.preventDefault()
    try {
      if (editingArticle) await api.put(`/admin/articles/${editingArticle}`, articleForm)
      else await api.post('/admin/articles', articleForm)
      notify(editingArticle ? 'Bài viết đã được cập nhật.' : 'Bản nháp bài viết đã được tạo.')
      setEditingArticle(null)
      setArticleForm(blankArticle)
      load()
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const editArticle = (article) => {
    setEditingArticle(article.article_id)
    setArticleForm({
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      content: article.content,
      status: article.status === 'Published' ? 'Draft' : article.status,
      product_ids: article.product_ids || [],
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const importArticle = async (event) => {
    const [file] = event.target.files
    if (!file) return
    try {
      if (!file.name.toLowerCase().endsWith('.docx')) throw new Error('Chỉ hỗ trợ tệp DOCX.')
      if (file.size > 10 * 1024 * 1024) throw new Error('Tệp DOCX không được vượt quá 10 MB.')
      const dataUrl = await fileToDataUrl(file)
      const response = await api.post('/admin/articles/import', {
        file_name: file.name,
        docx_base64: dataUrl.split(',')[1],
      })
      notify(response.warnings?.[0] || 'Đã nhập DOCX thành bản nháp.')
      load()
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      event.target.value = ''
    }
  }

  const publishArticle = async (article) => {
    if (!window.confirm(`Xuất bản "${article.title}"?`)) return
    try {
      await api.post(`/admin/articles/${article.article_id}/publish`, {})
      notify('Bài viết đã được xuất bản.')
      load()
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const createUser = async (event) => {
    event.preventDefault()
    try {
      const response = await api.post('/admin/users', userForm)
      setUserForm({ full_name: '', email: '', role: 'staff', password: '' })
      notify(response.temporary_password
        ? `Đã tạo tài khoản. Mật khẩu tạm (chỉ hiển thị lần này): ${response.temporary_password}`
        : 'Đã tạo tài khoản.')
      load()
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const mutate = async (path, body, message) => {
    try {
      await api.patch(path, body)
      notify(message)
      load()
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const rejectRefund = (refund) => {
    const rejectionReason = window.prompt('Nhập lý do từ chối yêu cầu hoàn tiền (ít nhất 5 ký tự):')
    if (!rejectionReason) return
    mutate(
      `/admin/refunds/${refund.refund_id}`,
      { status: 'Rejected', rejection_reason: rejectionReason },
      'Yêu cầu hoàn tiền đã bị từ chối.',
    )
  }

  if (!data) return <main className="shell page"><Loading label="Đang tổng hợp dữ liệu vận hành..." /></main>
  const tabs = [
    ['overview', 'Tổng quan', LayoutDashboard, true],
    ['products', 'Sản phẩm', Boxes, canOperate],
    ['categories', 'Danh mục', Store, canOperate],
    ['orders', 'Đơn hàng', PackageCheck, canOperate],
    ['reviews', 'Đánh giá', MessageSquareText, canOperate],
    ['articles', 'Cẩm nang', FileText, canEditContent],
    ['users', 'Người dùng', Users, isAdmin],
    ['refunds', 'Hoàn tiền', BadgeDollarSign, canOperate],
  ].filter(([, , , visible]) => visible)
  return (
    <main className="admin-shell">
      <aside className="admin-nav">
        <div><span className="brand__mark"><Flower2 /></span><b>Flowery Ops</b><small>Backoffice</small></div>
        <nav>{tabs.map(([value, label, Icon]) => (
          <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}><Icon size={18} />{label}</button>
        ))}</nav>
        <footer className="admin-nav__footer">
          <a href="/api/partner/catalog.xml?key=demo-partner-key" target="_blank" rel="noreferrer">Partner XML <ArrowRight size={15} /></a>
          <button type="button" onClick={onLogout}><LogOut size={16} />Đăng xuất</button>
        </footer>
      </aside>
      <section className="admin-content">
        <div className="admin-heading"><div><span className="eyebrow">Trung tâm vận hành</span><h1>{tabs.find(([value]) => value === tab)?.[1]}</h1></div><button className="icon-button" onClick={load}><RefreshCw size={18} /></button></div>

        {tab === 'overview' && (
          <>
            <div className="stats-grid">
              {[
                ['Doanh thu ghi nhận', money(data.stats.revenue), BadgeDollarSign],
                ['Tổng đơn hàng', data.stats.orders, PackageCheck],
                ['Đơn cần xử lý', data.stats.pending_orders, Clock3],
                ['Khách hàng', data.stats.customers, Users],
                ['Sản phẩm sắp hết', data.stats.low_stock, Boxes],
                ['Đánh giá chờ duyệt', data.stats.pending_reviews, MessageSquareText],
              ].map(([label, value, Icon]) => <article key={label}><span><Icon /></span><div><small>{label}</small><strong>{value}</strong></div></article>)}
            </div>
            {canOperate ? <div className="admin-panel">
              <h2>Đơn gần đây</h2>
              <AdminOrderTable orders={data.orders.slice(0, 6)} mutate={mutate} />
            </div> : <div className="admin-panel">
              <h2>Không gian biên tập</h2>
              <p className="muted">Bạn có {data.articles.filter((article) => article.status !== 'Published').length} bản thảo cần hoàn thiện và {data.articles.filter((article) => article.status === 'Published').length} bài đã xuất bản.</p>
              <button className="button button--primary" onClick={() => setTab('articles')}>Mở cẩm nang hoa</button>
            </div>}
          </>
        )}

        {tab === 'products' && (
          <>
            <form className="admin-form" onSubmit={submitProduct}>
              <div className="admin-form__heading"><h2>{editing ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2>{editing && <button type="button" className="text-button" onClick={() => { setEditing(null); setProductForm(blankProduct) }}>Hủy chỉnh sửa</button>}</div>
              <div className="admin-form-grid">
                <label>Tên sản phẩm<input required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
                <label>Danh mục<select required value={productForm.category_id} onChange={(event) => setProductForm({ ...productForm, category_id: Number(event.target.value) })}><option value="">Chọn danh mục</option>{data.categories.filter((category) => category.active).map((category) => <option key={category.category_id} value={category.category_id}>{category.name}</option>)}</select></label>
                <label>Giá bán<input type="number" min="1000" required value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: Number(event.target.value) })} /></label>
                <label>Tồn kho<input type="number" min="0" required value={productForm.stock_quantity} onChange={(event) => setProductForm({ ...productForm, stock_quantity: Number(event.target.value) })} /></label>
                <label>Dịp tặng<input value={productForm.occasion} onChange={(event) => setProductForm({ ...productForm, occasion: event.target.value })} /></label>
                <label>Màu chủ đạo<input value={productForm.color} onChange={(event) => setProductForm({ ...productForm, color: event.target.value })} /></label>
                <label>Loại hoa<input value={productForm.flower_type} onChange={(event) => setProductForm({ ...productForm, flower_type: event.target.value })} /></label>
                <label>URL ảnh (để trống để tạo ảnh mẫu)<input value={productForm.image_url || ''} onChange={(event) => setProductForm({ ...productForm, image_url: event.target.value })} /></label>
                <label className="wide">Mô tả<textarea required value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label>
                <label className="wide">Góc nghệ nhân<textarea value={productForm.editorial_review} onChange={(event) => setProductForm({ ...productForm, editorial_review: event.target.value })} /></label>
              </div>
              <button className="button button--dark">{editing ? 'Lưu thay đổi' : 'Tạo sản phẩm'}</button>
            </form>
            <div className="admin-panel table-wrap">
              <table><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Giá</th><th>Kho</th><th>Trạng thái</th><th></th></tr></thead>
                <tbody>{data.products.map((product) => <tr key={product.product_id}>
                  <td><div className="table-product"><img src={product.image_url} alt="" /><span><b>{product.name}</b><small>#{product.product_id} · {product.slug}</small></span></div></td>
                  <td>{product.category_name}</td><td>{money(product.price)}</td><td className={product.stock_quantity <= 10 ? 'text-danger' : ''}>{product.stock_quantity}</td><td><span className={`status ${product.active ? 'status--approved' : 'status--cancelled'}`}>{product.active ? 'Đang bán' : 'Lưu trữ'}</span></td>
                  <td><div className="row-actions"><button onClick={() => editProduct(product)}><Edit3 size={17} /></button>{Boolean(product.active) && <button onClick={() => archiveProduct(product)}><Trash2 size={17} /></button>}</div></td>
                </tr>)}</tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'categories' && (
          <>
            <form className="admin-form admin-form--compact" onSubmit={addCategory}>
              <div className="admin-form__heading"><h2>{editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục'}</h2>{editingCategory && <button type="button" className="text-button" onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '' }) }}>Hủy chỉnh sửa</button>}</div>
              <label>Tên danh mục<input required value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} /></label>
              <label>Mô tả<input value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} /></label>
              <button className="button button--dark">{editingCategory ? 'Lưu thay đổi' : 'Thêm danh mục'}</button>
            </form>
            <div className="admin-panel table-wrap"><table><thead><tr><th>Tên</th><th>Slug</th><th>Mô tả</th><th>Sản phẩm</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>{data.categories.map((category) => <tr key={category.category_id}><td><b>{category.name}</b></td><td>{category.slug}</td><td>{category.description}</td><td>{category.product_count}</td><td>{category.active ? 'Hoạt động' : 'Ẩn'}</td><td><div className="row-actions"><button title="Chỉnh sửa" onClick={() => editCategory(category)}><Edit3 size={17} /></button>{category.active ? <button title="Ngừng sử dụng" onClick={() => archiveCategory(category)}><Trash2 size={17} /></button> : <button className="approve" title="Kích hoạt lại" onClick={() => reactivateCategory(category)}><Check size={17} /></button>}</div></td></tr>)}</tbody>
            </table></div>
          </>
        )}

        {tab === 'orders' && <div className="admin-panel"><AdminOrderTable orders={data.orders} mutate={mutate} /></div>}

        {tab === 'reviews' && <div className="admin-panel table-wrap"><table><thead><tr><th>Khách hàng</th><th>Sản phẩm</th><th>Đánh giá</th><th>Nội dung</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>{data.reviews.map((review) => <tr key={review.review_id}><td><b>{review.full_name}</b><small>{review.email}</small></td><td>{review.product_name}</td><td className="stars">{'★'.repeat(review.rating)}</td><td>{review.comment}</td><td><StatusBadge status={review.status} /></td><td>{review.status === 'Pending' && <div className="row-actions"><button className="approve" onClick={() => mutate(`/admin/reviews/${review.review_id}`, { status: 'Approved' }, 'Đánh giá đã được duyệt.')}><Check /></button><button className="reject" onClick={() => mutate(`/admin/reviews/${review.review_id}`, { status: 'Rejected' }, 'Đánh giá đã bị từ chối.')}><X /></button></div>}</td></tr>)}</tbody>
        </table></div>}

        {tab === 'articles' && <>
          <form className="admin-form" onSubmit={submitArticle}>
            <div className="admin-form__heading"><div><h2>{editingArticle ? 'Chỉnh sửa bài viết' : 'Tạo bài viết'}</h2><small>Biên tập theo vòng đời Draft → InReview → Published.</small></div><label className="button button--outline file-button"><Upload size={17} />Nhập DOCX<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={importArticle} /></label></div>
            <div className="admin-form-grid">
              <label>Tiêu đề<input required minLength="4" value={articleForm.title} onChange={(event) => setArticleForm({ ...articleForm, title: event.target.value })} /></label>
              <label>Slug (có thể để trống)<input value={articleForm.slug} onChange={(event) => setArticleForm({ ...articleForm, slug: event.target.value })} /></label>
              <label className="wide">Tóm tắt<textarea required minLength="10" maxLength="600" value={articleForm.summary} onChange={(event) => setArticleForm({ ...articleForm, summary: event.target.value })} /></label>
              <label className="wide">Nội dung<textarea required minLength="20" rows="10" value={articleForm.content} onChange={(event) => setArticleForm({ ...articleForm, content: event.target.value })} /></label>
              <label>Trạng thái<select value={articleForm.status} onChange={(event) => setArticleForm({ ...articleForm, status: event.target.value })}><option value="Draft">Bản nháp</option><option value="InReview">Chờ duyệt</option></select></label>
              <label>Sản phẩm liên quan<select multiple value={articleForm.product_ids.map(String)} onChange={(event) => setArticleForm({ ...articleForm, product_ids: [...event.target.selectedOptions].map((option) => Number(option.value)) })}>{data.products.map((product) => <option key={product.product_id} value={product.product_id}>{product.name}</option>)}</select><small>Giữ Ctrl để chọn nhiều sản phẩm.</small></label>
            </div>
            <div className="row-actions row-actions--text"><button className="button button--dark">{editingArticle ? 'Lưu phiên bản mới' : 'Lưu bản nháp'}</button>{editingArticle && <button type="button" className="button button--outline" onClick={() => { setEditingArticle(null); setArticleForm(blankArticle) }}>Hủy chỉnh sửa</button>}</div>
          </form>
          <div className="admin-panel table-wrap"><table><thead><tr><th>Bài viết</th><th>Tác giả</th><th>Phiên bản</th><th>Liên kết</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>{data.articles.map((article) => <tr key={article.article_id}><td><b>{article.title}</b><small>{article.source_filename || article.slug}</small></td><td>{article.author_name || 'Flowery'}</td><td>v{article.version}</td><td>{article.product_ids?.length || 0} sản phẩm{article.media?.length ? ` · ${article.media.length} ảnh` : ''}</td><td><StatusBadge status={article.status} /></td><td><div className="row-actions"><button title="Chỉnh sửa" onClick={() => editArticle(article)}><Edit3 size={17} /></button>{article.status !== 'Published' && article.status !== 'Archived' && <button className="approve" title="Xuất bản" onClick={() => publishArticle(article)}><Check size={17} /></button>}{article.status !== 'Archived' && <button title="Lưu trữ" onClick={async () => { if (window.confirm(`Lưu trữ "${article.title}"?`)) { await api.delete(`/admin/articles/${article.article_id}`); notify('Bài viết đã được lưu trữ.'); load() } }}><Trash2 size={17} /></button>}</div></td></tr>)}</tbody>
          </table></div>
        </>}

        {tab === 'users' && <>
          <form className="admin-form admin-form--compact" onSubmit={createUser}>
            <h2>Tạo tài khoản nội bộ</h2>
            <label>Họ và tên<input required minLength="2" value={userForm.full_name} onChange={(event) => setUserForm({ ...userForm, full_name: event.target.value })} /></label>
            <label>Email<input required type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label>
            <label>Vai trò<select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}><option value="staff">Nhân viên vận hành</option><option value="editor">Biên tập viên</option><option value="customer">Khách hàng</option></select></label>
            <label>Mật khẩu ban đầu<input type="password" minLength="10" placeholder="Để trống để hệ thống tự sinh" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /></label>
            <button className="button button--dark">Tạo tài khoản</button>
          </form>
          <div className="admin-panel table-wrap"><table><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Ngày tạo</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>{data.users.map((entry) => <tr key={entry.user_id}><td><b>{entry.full_name}</b><small>{entry.email}{entry.must_change_password ? ' · Cần đổi mật khẩu' : ''}</small></td><td><select value={entry.role} disabled={entry.role === 'admin'} onChange={(event) => mutate(`/admin/users/${entry.user_id}`, { role: event.target.value }, 'Vai trò đã được cập nhật.')}>{['customer', 'staff', 'editor'].map((role) => <option key={role}>{role}</option>)}{entry.role === 'admin' && <option value="admin">admin</option>}</select></td><td>{formatDate(entry.created_at)}</td><td><span className={`status ${entry.is_locked ? 'status--cancelled' : 'status--approved'}`}>{entry.is_locked ? 'Đã khóa' : 'Hoạt động'}</span></td><td><button className="text-button" disabled={entry.user_id === user.user_id || entry.role === 'admin'} onClick={() => mutate(`/admin/users/${entry.user_id}`, { is_locked: !entry.is_locked }, entry.is_locked ? 'Tài khoản đã mở khóa.' : 'Tài khoản đã khóa.')}>{entry.is_locked ? 'Mở khóa' : 'Khóa'}</button></td></tr>)}</tbody>
          </table></div>
        </>}

        {tab === 'refunds' && <div className="admin-panel table-wrap"><table><thead><tr><th>Đơn hàng</th><th>Khách hàng</th><th>Lý do / bằng chứng</th><th>Số tiền</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>{data.refunds.length === 0 ? <tr><td colSpan="6" className="table-empty">Chưa có yêu cầu hoàn tiền.</td></tr> : data.refunds.map((refund) => <tr key={refund.refund_id}><td><b>{refund.order_number}</b></td><td>{refund.full_name}</td><td>{refund.reason}{refund.evidence_url && <small><a href={refund.evidence_url} target="_blank" rel="noreferrer">Mở bằng chứng</a></small>}{refund.rejection_reason && <small className="text-danger">Từ chối: {refund.rejection_reason}</small>}</td><td>{money(refund.amount)}</td><td><StatusBadge status={refund.status} />{refund.status === 'Approved' && <small>Chờ cổng thanh toán xác nhận</small>}</td><td>{refund.status === 'Pending' && <div className="row-actions"><button className="approve" title="Duyệt yêu cầu" onClick={() => mutate(`/admin/refunds/${refund.refund_id}`, { status: 'Approved' }, 'Yêu cầu đã được duyệt và đang chờ cổng thanh toán.')}><Check /></button><button className="reject" title="Từ chối yêu cầu" onClick={() => rejectRefund(refund)}><X /></button></div>}</td></tr>)}</tbody>
        </table></div>}
      </section>
    </main>
  )
}

function AdminOrderTable({ orders, mutate }) {
  const optionsByStatus = {
    Confirmed: ['Confirmed', 'Preparing', 'Cancelled'],
    Preparing: ['Preparing', 'Shipping', 'Cancelled'],
    Shipping: ['Shipping'],
    Delivered: ['Delivered'],
    Cancelled: ['Cancelled'],
  }

  const changeStatus = (order, status) => {
    if (status === order.status) return
    const body = { status }
    if (status === 'Shipping') {
      const carrier = window.prompt('Nhập đơn vị vận chuyển:', order.carrier || 'Flowery Express')
      if (!carrier) return
      const trackingCode = window.prompt('Nhập mã vận đơn:', order.tracking_code || '')
      if (!trackingCode) return
      body.carrier = carrier
      body.tracking_code = trackingCode
    }
    mutate(`/admin/orders/${order.order_id}`, body, 'Trạng thái đơn hàng đã cập nhật.')
  }

  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Mã đơn</th><th>Người nhận</th><th>Giá trị</th><th>Thanh toán</th><th>Trạng thái</th></tr></thead>
        <tbody>{orders.map((order) => (
          <tr key={order.order_id}>
            <td><b>{order.order_number}</b><small>{formatDate(order.created_at)}</small></td>
            <td>{order.customer_name}<small>{order.customer_phone}</small></td>
            <td>{money(order.total_amount)}</td><td><StatusBadge status={order.payment_status} /></td>
            <td><select value={order.status} disabled={['Shipping', 'Delivered', 'Cancelled'].includes(order.status)} onChange={(event) => changeStatus(order, event.target.value)}>{optionsByStatus[order.status].map((status) => <option key={status} value={status}>{orderLabels[status]}</option>)}</select></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function WishlistView({ products, wishlistIds, onWish, onSelect, onAdd, onContinue }) {
  const items = products.filter((product) => wishlistIds.includes(product.product_id))
  return (
    <main className="shell page">
      <div className="page-heading"><div><span className="eyebrow">Để dành cho dịp đặc biệt</span><h1>Hoa bạn yêu thích</h1></div></div>
      {items.length === 0 ? (
        <EmptyState icon={Heart} title="Chưa có sản phẩm yêu thích" text="Nhấn biểu tượng trái tim để lưu những mẫu hoa khiến bạn rung động." action={<button className="button button--primary" onClick={onContinue}>Khám phá hoa</button>} />
      ) : (
        <div className="product-grid">
          {items.map((product) => <ProductCard key={product.product_id} product={product} wished onWish={onWish} onSelect={onSelect} onAdd={onAdd} />)}
        </div>
      )}
    </main>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div><div className="brand brand--light"><span className="brand__mark"><Flower2 /></span><span><b>Flowery</b><small>Trao hoa, gửi thương</small></span></div><p>Hoa tươi thiết kế theo đơn, giao tận tay và lưu giữ từng khoảnh khắc đáng nhớ.</p></div>
        <div><b>Khám phá</b><a href="#collection">Bộ sưu tập</a><a href="#journal">Cẩm nang hoa</a><a href="/api/partner/catalog.xml?key=demo-partner-key" target="_blank" rel="noreferrer">Partner XML</a></div>
        <div><b>Cam kết</b><span>Hoa tươi tuyển chọn</span><span>Thanh toán bảo mật</span><span>Hỗ trợ 08:00–21:00</span></div>
        <div><b>Liên hệ</b><span>hello@flowery.vn</span><span>1900 6868</span><span>TP. Hồ Chí Minh</span></div>
      </div>
      <div className="shell footer-bottom"><span>© 2026 Flowery. All rights reserved.</span><span>Privacy · Terms · Delivery</span></div>
    </footer>
  )
}

function App() {
  const [view, setView] = useState('home')
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [catalogMeta, setCatalogMeta] = useState({ occasions: [], colors: [] })
  const [articles, setArticles] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [cart, setCart] = useState(() => readStorage(CART_KEY, []))
  const [wishlistIds, setWishlistIds] = useState(() => readStorage(WISHLIST_KEY, []))
  const [filters, setFilters] = useState({ q: '', category: '', occasion: '', color: '', sort: 'featured' })
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const loadCustomerData = useCallback(async () => {
    const [cartResponse, wishlistResponse] = await Promise.all([
      api.get('/cart'),
      api.get('/wishlist'),
    ])
    setCart(cartResponse.items)
    setWishlistIds(wishlistResponse.items.map((item) => item.product_id))
  }, [])

  useEffect(() => {
    const restore = async () => {
      if (!hasToken()) {
        setAuthReady(true)
        return
      }
      try {
        const response = await api.get('/me')
        setUser(response.user)
        await loadCustomerData()
      } catch {
        setToken('')
      } finally {
        setAuthReady(true)
      }
    }
    restore()
  }, [loadCustomerData])

  useEffect(() => {
    Promise.all([api.get('/categories'), api.get('/articles')])
      .then(([categoryResponse, articleResponse]) => {
        setCategories(categoryResponse.items)
        setArticles(articleResponse.items)
      })
      .catch((error) => notify(error.message, 'error'))
  }, [notify])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setCatalogLoading(true)
      const query = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => value && query.set(key, value))
      query.set('limit', '48')
      try {
        const response = await api.get(`/products?${query}`, { signal: controller.signal })
        setProducts(response.items)
        setCatalogMeta(response.filters)
      } catch (error) {
        if (error.name !== 'AbortError') notify(error.message, 'error')
      } finally {
        setCatalogLoading(false)
      }
    }, 220)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [filters, notify])

  const navigate = useCallback((next) => {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const syncGuestData = async () => {
    const guestCart = readStorage(CART_KEY, [])
    const guestWishlist = readStorage(WISHLIST_KEY, [])
    await Promise.all([
      ...guestCart.map((item) => api.post('/cart', { product_id: item.product_id, quantity: item.quantity })),
      ...guestWishlist.map((productId) => api.post(`/wishlist/${productId}`, {})),
    ])
    localStorage.removeItem(CART_KEY)
    localStorage.removeItem(WISHLIST_KEY)
  }

  const onAuthenticated = async (payload) => {
    setToken(payload.token)
    setUser(payload.user)
    await syncGuestData()
    await loadCustomerData()
    navigate(BACKOFFICE_ROLES.has(payload.user.role) ? 'admin' : 'home')
  }

  const logout = () => {
    setToken('')
    setUser(null)
    setCart([])
    setWishlistIds([])
    navigate('home')
    notify('Bạn đã đăng xuất.')
  }

  const addToCart = async (product, quantity = 1) => {
    try {
      if (user) {
        await api.post('/cart', { product_id: product.product_id, quantity })
        await loadCustomerData()
      } else {
        setCart((current) => {
          const existing = current.find((item) => item.product_id === product.product_id)
          const next = existing
            ? current.map((item) => item.product_id === product.product_id ? { ...item, quantity: item.quantity + quantity } : item)
            : [...current, { ...product, quantity }]
          localStorage.setItem(CART_KEY, JSON.stringify(next))
          return next
        })
      }
      notify(`${product.name} đã được thêm vào giỏ.`)
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const updateQuantity = async (item, quantity) => {
    try {
      if (user) {
        await api.patch(`/cart/${item.product_id}`, { quantity })
        await loadCustomerData()
      } else {
        setCart((current) => {
          const next = current.map((entry) => entry.product_id === item.product_id ? { ...entry, quantity } : entry)
          localStorage.setItem(CART_KEY, JSON.stringify(next))
          return next
        })
      }
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const removeFromCart = async (item) => {
    try {
      if (user) {
        await api.delete(`/cart/${item.product_id}`)
        await loadCustomerData()
      } else {
        setCart((current) => {
          const next = current.filter((entry) => entry.product_id !== item.product_id)
          localStorage.setItem(CART_KEY, JSON.stringify(next))
          return next
        })
      }
      notify('Đã bỏ sản phẩm khỏi giỏ.')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const toggleWishlist = async (product) => {
    const wished = wishlistIds.includes(product.product_id)
    try {
      if (user) {
        if (wished) await api.delete(`/wishlist/${product.product_id}`)
        else await api.post(`/wishlist/${product.product_id}`, {})
        await loadCustomerData()
      } else {
        setWishlistIds((current) => {
          const next = wished ? current.filter((id) => id !== product.product_id) : [...current, product.product_id]
          localStorage.setItem(WISHLIST_KEY, JSON.stringify(next))
          return next
        })
      }
      notify(wished ? 'Đã bỏ khỏi danh sách yêu thích.' : 'Đã lưu vào danh sách yêu thích.')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const selectProduct = (productId) => {
    setSelectedProductId(productId)
    navigate('detail')
  }

  const checkout = async (payload) => {
    if (!payload || !user) {
      navigate('auth')
      notify('Vui lòng đăng nhập trước khi đặt hoa.', 'error')
      return
    }
    const response = await api.post('/orders', payload, {
      headers: { 'Idempotency-Key': payload.idempotency_key },
    })
    setCart([])
    notify(`Đặt hoa thành công: ${response.order.order_number}`)
    navigate('orders')
  }

  const wishlistProducts = useMemo(() => {
    if (user && view === 'wishlist') {
      return products
    }
    return products
  }, [products, user, view])
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const adminView = view === 'admin'

  if (!authReady) return <div className="app-loader"><Flower2 /><Loading label="Đang mở cửa Flowery..." /></div>
  return (
    <div className="app">
      {!adminView && (
        <Header
          user={user}
          view={view}
          cartCount={cartCount}
          wishlistCount={wishlistIds.length}
          search={filters.q}
          onSearch={(q) => setFilters((current) => ({ ...current, q }))}
          navigate={navigate}
          onLogout={logout}
        />
      )}

      {view === 'home' && <HomeView products={products} categories={categories} catalogMeta={catalogMeta} articles={articles} filters={filters} setFilters={setFilters} loading={catalogLoading} wishlistIds={wishlistIds} onWish={toggleWishlist} onSelect={selectProduct} onAdd={addToCart} />}
      {view === 'detail' && selectedProductId && <ProductDetailView productId={selectedProductId} user={user} wished={wishlistIds.includes(selectedProductId)} onBack={() => navigate('home')} onWish={toggleWishlist} onAdd={addToCart} onSelect={selectProduct} onLogin={() => navigate('auth')} notify={notify} />}
      {view === 'auth' && <AuthView onAuthenticated={onAuthenticated} notify={notify} />}
      {view === 'cart' && <CartView cart={cart} user={user} onQuantity={updateQuantity} onRemove={removeFromCart} onCheckout={checkout} onContinue={() => navigate('home')} notify={notify} />}
      {view === 'wishlist' && <WishlistView products={wishlistProducts} wishlistIds={wishlistIds} onWish={toggleWishlist} onSelect={selectProduct} onAdd={addToCart} onContinue={() => navigate('home')} />}
      {view === 'orders' && user && <OrdersView notify={notify} />}
      {view === 'orders' && !user && <AuthView onAuthenticated={onAuthenticated} notify={notify} />}
      {view === 'account' && user && <AccountView user={user} onUpdated={setUser} notify={notify} />}
      {view === 'admin' && BACKOFFICE_ROLES.has(user?.role) && <AdminView user={user} notify={notify} onLogout={logout} />}
      {view === 'admin' && !BACKOFFICE_ROLES.has(user?.role) && <AuthView onAuthenticated={onAuthenticated} notify={notify} />}

      {!adminView && <Footer />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}

export default App
