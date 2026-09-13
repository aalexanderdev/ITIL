# OpenITIL

[![Ruby on Rails](https://img.shields.io/badge/Ruby_on_Rails-8.1-CC0000.svg?logo=rubyonrails&logoColor=white)](https://rubyonrails.org)
[![Ruby Version](https://img.shields.io/badge/Ruby-3.4+-red.svg?logo=ruby&logoColor=white)](https://www.ruby-lang.org)
[![Database](https://img.shields.io/badge/Database-SQLite3_WAL-003B57.svg?logo=sqlite&logoColor=white)](https://sqlite.org)
[![Architecture](https://img.shields.io/badge/ITSM-ITIL_Aligned-4F46E5.svg)](#features)

**OpenITIL** is a modern, open-source IT Service Management (ITSM) and IT Asset Management (ITAM / CMDB) web platform inspired by GLPI, developed with **Ruby on Rails 8** and modern web standards.

Unlike traditional PHP-based helpdesk interfaces, OpenITIL offers a clean, fast, and responsive user experience powered by Hotwire (Turbo + Stimulus) and a bespoke Vanilla CSS design system, eliminating complex JavaScript build pipelines while maintaining an enterprise-grade feature set.

---

## Key Features

### 1. Helpdesk & Service Desk (ITSM)
- **Incident & Service Request Management**: Differentiate between unplanned interruptions (incidents) and routine user demands (service requests).
- **ITIL Urgency × Impact Priority Matrix**: Automatically computes priority levels (1: Very Low to 6: Critical / Major) based on standard 5×5 ITIL matrices.
- **Service Level Agreements (SLA)**: Automated resolution deadlines computed from ticket priority with real-time overdue alerts.
- **Interactive Ticket Timeline**:
  - Public follow-ups between requesters and technicians.
  - Staff-only private notes for internal collaboration.
  - Technical tasks with dedicated time tracking (minutes spent).
  - Formal solution workflows with approval states.

### 2. IT Asset Management & CMDB (ITAM)
- **Comprehensive Hardware Tracking**: Manage computers, laptops, physical/virtual servers, network gear (switches, routers, firewalls, APs), printers, monitors, and VoIP phones.
- **Automated Asset Tagging**: Automated identifier generator (`PC-XXXXXX`, `SRV-XXXXXX`, `NET-XXXXXX`).
- **Technical & Network Specifications**: Processor (CPU), RAM, storage, operating system, serial numbers (S/N), static/DHCP IPv4 addresses, and physical MAC addresses.
- **Financial & Warranty Tracking**: Purchase dates, warranty expirations, and custody history.
- **Bi-directional Asset-Ticket Linking**: Attach affected devices to support tickets, and view full maintenance and failure histories directly on the asset's technical sheet.

### 3. Role-Based Access Control (RBAC) & Profile Management (GLPI-Style)
- **Granular Permissions Matrix**: Configurable permission sets across Ticket operations (view all, create, edit, assign, solve, close, delete, internal notes), Asset management, Knowledge Base, HelpdeskChat access/configuration, and administrative authority.
- **Built-in System Profiles**:
  - **Super-Administrator**: Full system authority over tickets, assets, users, profiles, locations, and chat configuration.
  - **IT Support Technician**: Operational control of tickets, internal technical notes, time tracking, and asset inventory.
  - **Self-Service User**: Portal access for raising requests, tracking ticket status, viewing assigned hardware, and live chat.
  - **Observer / Read-Only**: Read-only oversight for audits, compliance, and reporting.
- **Profile Administration (`/profiles`)**: Full administrative CRUD to create, inspect, edit, and assign custom profiles with visual badge tags and active user counts.
- **Personal "My Profile" (`/profile`)**: Dedicated self-service screen where any logged-in user can update contact info, change passwords securely with confirmation validation, review their assigned hardware assets, and track recent support requests.

### 4. Knowledge Base (FAQ)
- Centralized repository of how-to manuals, troubleshooting procedures, and self-help articles categorized by service domain with view analytics.

### 5. ITSM Operations Dashboard
- Real-time KPI summary cards: Open Tickets, Solved Tickets, Critical Incidents, and Active Hardware Assets.
- Technician workload inbox with assigned tickets.
- Hardware asset distribution progress indicators (In Use, In Stock, Under Repair, Disposed).

### 6. Native HelpdeskChat (Real-Time Communication & ITSM Alerts)
- **Floating Widget**: Floating launcher with badge indicator, conversation search, user filtering, and collapsible panel.
- **Thread Modes**: Direct 1-on-1 messaging, department/group chat rooms, and a dedicated personal "System Notifications" stream.
- **Automated Lifecycle Notifications**: Automatic notices pushed to technicians and requesters on ticket creation, assignment, resolution, comments, and private notes.
- **Message-to-Ticket Conversion**: Technicians can convert incoming chat messages directly into formal support tickets with pre-filled descriptions and category matching.
- **Presence & Collaboration**: Live heartbeat status (online/offline), typing indicators, double-check read receipts, and message emoji reactions.
- **Zero External Overhead**: 100% native Rails 8 Active Record implementation without external Redis or third-party WebSocket server requirements.

### 7. Administrative HelpdeskChat Settings Panel
- **Branding & Appearance**: Custom hex color pickers with real-time sync for launcher icon, message bubbles, and user mentions.
- **Layout & Typography**: Adjustable panel width (320px to 700px) and font size slider (11px to 20px) with live typography preview.
- **Real-Time Polling & Performance**: Configurable refresh intervals for messages, conversation lists, online presence heartbeats, and maximum message lengths.
- **Feature & Privacy Toggles**: One-click administrative control over presence indicators, typing status, read receipts (double check), and notification sounds.
- **ITSM Policy Management**: Fine-tune message-to-ticket conversion options and enable/disable automated notifications for assignments, resolutions, comments, and internal notes.

### 8. Native VisualHub & Accessibility Suite (WCAG 2.2 AA / AAA)
- **Assistive Accessibility Widget**: Floating launcher with keyboard shortcut (`Alt + A`) for instant access to visual accommodations.
- **Regional Text-to-Speech (TTS) Engine**: Built on the native Web Speech API with regional dialect resolvers (Spanish, English, Portuguese, French), adjustable reading speeds (0.75x to 1.5x), and a floating mini audio player.
- **Point-to-Read & Smart Content Fallback**: Automatically voices paragraphs upon cursor hover or focus, with contextual fallback reading for ticket cards and knowledge base articles.
- **Visual Filters & Contrast Controls**:
  - One-click Dark Mode / Light Mode toggle with instant CSS variable updates.
  - High Contrast mode complying with WCAG AAA contrast ratios.
  - Monochromatic (Grayscale) filter.
  - Media-Safe Invert filter protecting images, photos, and video elements from colour inversion.
- **Reading Guides & Ergonomics**:
  - Horizontal reading tracker line that follows the cursor across the screen.
  - High-visibility focus ring for accessible keyboard navigation.
  - Large contrast cursor option.
  - Dyslexia-friendly typography and adjustable text/line spacing.
- **Administrative Theming & Branding**: Centralized administration console (`/visualhub_settings`) to customize system branding (application name, logo, login greeting), primary and accent color palettes, and default accessibility preferences.

### 9. OpenITIL Bottom Navigation Dock & Full-Width Workspace
- **100% Horizontal Screen Utilization**: The traditional fixed sidebar is replaced with a centered, floating bottom dock, freeing up full horizontal screen real estate for ITSM data tables, incident management, and hardware CMDB trees.
- **Collapsible / Minimizable Floating Dock**: A discreet toggle handle allows collapsing the dock downwards with a smooth cubic-bezier transition, revealing only a compact peek handle. Preference state is persisted in `localStorage`.
- **Keyboard Ergonomics**: Toggle the navigation dock instantly from anywhere with the `Alt + M` keyboard shortcut.
- **Upward Administration Popover**: Administrators have quick access to User, Profile, Department, HelpdeskChat, and VisualHub administration via a floating glassmorphic popover menu oriented upwards.
- **Edge-to-Edge Top App Bar**: Displays company branding, global search, instant dark mode switch, quick "+ New Ticket" action, and user profile capsule.

---

## Technology Stack

- **Backend**: [Ruby](https://www.ruby-lang.org) 3.4+ & [Ruby on Rails](https://rubyonrails.org) 8.1
- **Database**: SQLite3 with WAL (Write-Ahead Logging) mode and Rails 8 Solid adapters (`solid_cache`, `solid_queue`, `solid_cable`)
- **Frontend & Assets**: [Hotwire](https://hotwired.dev) (Turbo 8 + Stimulus), [Propshaft](https://github.com/rails/propshaft) Asset Pipeline, and bespoke Vanilla CSS design tokens with *Plus Jakarta Sans* typography
- **Authentication**: Native Rails 8 authentication with `BCrypt` password hashing and secure HTTP-only sessions
- **Chat & Real-Time**: Native HelpdeskChat engine with presence heartbeat, read receipts, and ITSM hook dispatchers
- **Testing**: Minitest test suite with ActiveSupport integration tests

---

## Getting Started

### Prerequisites
- **Ruby** 3.4.0 or higher
- **Bundler** 4.0+
- **SQLite3** development headers (`libsqlite3-dev` or equivalent)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/aalexanderdev/OpenITIL.git
   cd OpenITIL
   ```

2. **Install Ruby dependencies**:
   ```bash
   bundle config set --local path 'vendor/bundle'
   bundle install
   ```

3. **Database Setup & Seeds**:
   ```bash
   bin/rails db:migrate
   bin/rails db:seed
   ```

4. **Launch the Development Server**:
   ```bash
   bin/rails server
   ```

   Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Demo & Test Credentials

The database seeds populate the application with pre-configured accounts across all roles:

| Role | Email Address | Password |
| :--- | :--- | :--- |
| **Global Administrator** | `admin@itil.local` | `password123` |
| **IT Support Technician** | `tecnico@itil.local` | `password123` |
| **Support Specialist** | `soporte@itil.local` | `password123` |
| **End User (Self-Service)** | `usuario@itil.local` | `password123` |

*(The login screen also features quick-select demo buttons to switch between accounts with a single click)*

---

## Running Automated Tests

Run the complete test suite (unit models, controllers, and integration flows):

```bash
bin/rails test
```

All tests should pass with 0 failures and 0 errors:
```text
Running 72 tests in parallel using 12 processes
72 runs, 319 assertions, 0 failures, 0 errors, 0 skips
```

---

## Project Structure

```text
├── app/
│   ├── assets/stylesheets/
│   │   ├── application.css                 # Core design system
│   │   ├── chat.css                        # HelpdeskChat styles & variables
│   │   └── visualhub.css                   # WCAG 2.2 accessibility & visual tokens
│   ├── controllers/
│   │   ├── assets_controller.rb            # ITAM / CMDB management
│   │   ├── chat/                           # Native HelpdeskChat controllers
│   │   │   ├── base_controller.rb
│   │   │   ├── config_controller.rb        # AJAX Config API endpoint
│   │   │   ├── conversations_controller.rb
│   │   │   ├── messages_controller.rb
│   │   │   ├── presence_controller.rb
│   │   │   ├── tickets_controller.rb
│   │   │   └── token_controller.rb
│   │   ├── chat_settings_controller.rb     # Administrative HelpdeskChat panel
│   │   ├── dashboard_controller.rb         # Real-time metrics
│   │   ├── kb_articles_controller.rb       # Knowledge Base
│   │   ├── profiles_controller.rb          # RBAC Profile administration (GLPI-style)
│   │   ├── sessions_controller.rb          # Authentication
│   │   ├── ticket_updates_controller.rb    # Timeline follow-ups & tasks
│   │   ├── tickets_controller.rb           # Helpdesk & ITIL workflow
│   │   ├── user_profiles_controller.rb     # Self-service "My Profile" & password update
│   │   ├── users_controller.rb             # User directory & profile assignment
│   │   └── visualhub_settings_controller.rb# VisualHub & WCAG 2.2 administration
│   ├── javascript/
│   │   ├── chat.js                         # HelpdeskChat UI engine & event loop
│   │   ├── controllers/
│   │   │   └── dock_controller.js          # Collapsible bottom dock Stimulus controller
│   │   └── visualhub.js                    # WCAG 2.2 speech synthesis & assistive engine
│   ├── models/
│   │   ├── asset.rb                        # Hardware asset model
│   │   ├── chat_conversation.rb            # Direct, group, and self threads
│   │   ├── chat_message.rb                 # Chat messages with reactions
│   │   ├── chat_presence.rb                # Online/offline presence heartbeats
│   │   ├── chat_setting.rb                 # Configuration singleton & defaults
│   │   ├── profile.rb                      # Granular RBAC permission matrix model
│   │   ├── ticket.rb                       # Ticket with ITIL matrix & SLA
│   │   ├── ticket_update.rb                # Timeline updates & notice hooks
│   │   ├── user.rb                         # User model with profile delegation
│   │   └── visualhub_setting.rb            # VisualHub & accessibility configuration
│   └── views/                              # Responsive view templates (visualhub, profiles, tickets...)
├── config/                                 # Routes, environments & Solid config
├── db/
│   ├── migrate/                            # Active Record migrations
│   ├── schema.rb                           # Database schema
│   └── seeds.rb                            # Sample ITSM & CMDB dataset
└── test/                                   # Model and integration tests (72 tests)
```

---

## License

This project is open-source software licensed under the [GNU General Public License v3.0](LICENSE).