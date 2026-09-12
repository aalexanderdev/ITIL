# OpenITIL

[![Ruby on Rails](https://img.shields.io/badge/Ruby_on_Rails-8.1-CC0000.svg?logo=rubyonrails&logoColor=white)](https://rubyonrails.org)
[![Ruby Version](https://img.shields.io/badge/Ruby-3.4+-red.svg?logo=ruby&logoColor=white)](https://www.ruby-lang.org)
[![Database](https://img.shields.io/badge/Database-SQLite3_WAL-003B57.svg?logo=sqlite&logoColor=white)](https://sqlite.org)
[![Architecture](https://img.shields.io/badge/ITSM-ITIL_Aligned-4F46E5.svg)](#features)

**OpenITIL** is a modern, open-source IT Service Management (ITSM) and IT Asset Management (ITAM / CMDB) web platform inspired by GLPI, developed with **Ruby on Rails 8** and modern web standards.

Unlike traditional PHP-based helpdesk interfaces, OpenITIL offers a clean, fast, and responsive user experience powered by Hotwire (Turbo + Stimulus) and a bespoke Vanilla CSS design system, eliminating complex JavaScript build pipelines while maintaining an enterprise-grade feature set.

---

## 🚀 Key Features

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

### 3. Role-Based Access Control (RBAC)
- **Administrator (`admin`)**: Complete system authority over users, physical sites, departments, service categories, and reporting.
- **Support Technician (`technician`)**: Assignment handling, internal notes, time logging, asset catalogue management, and knowledge article publishing.
- **End-User (`user`)**: Self-service portal to submit and track support requests, review equipment in their custody, and browse self-service FAQs.

### 4. Knowledge Base (FAQ)
- Centralized repository of how-to manuals, troubleshooting procedures, and self-help articles categorized by service domain with view analytics.

### 5. ITSM Operations Dashboard
- Real-time KPI summary cards: Open Tickets, Solved Tickets, Critical Incidents, and Active Hardware Assets.
- Technician workload inbox with assigned tickets.
- Hardware asset distribution progress indicators (In Use, In Stock, Under Repair, Disposed).

---

## 🛠️ Technology Stack

- **Backend**: [Ruby](https://www.ruby-lang.org) 3.4+ & [Ruby on Rails](https://rubyonrails.org) 8.1
- **Database**: SQLite3 with WAL (Write-Ahead Logging) mode and Rails 8 Solid adapters (`solid_cache`, `solid_queue`, `solid_cable`)
- **Frontend & Assets**: [Hotwire](https://hotwired.dev) (Turbo 8 + Stimulus), [Propshaft](https://github.com/rails/propshaft) Asset Pipeline, and bespoke Vanilla CSS design tokens with *Plus Jakarta Sans* typography
- **Authentication**: Native Rails 8 authentication with `BCrypt` password hashing and secure HTTP-only sessions
- **Testing**: Minitest test suite with ActiveSupport integration tests

---

## 📦 Getting Started

### Prerequisites
- **Ruby** 3.4.0 or higher
- **Bundler** 4.0+
- **SQLite3** development headers (`libsqlite3-dev` or equivalent)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/aalexanderdev/ITIL.git
   cd ITIL
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

## 🔑 Demo & Test Credentials

The database seeds populate the application with pre-configured accounts across all roles:

| Role | Email Address | Password |
| :--- | :--- | :--- |
| **Global Administrator** | `admin@itil.local` | `password123` |
| **IT Support Technician** | `tecnico@itil.local` | `password123` |
| **Support Specialist** | `soporte@itil.local` | `password123` |
| **End User (Self-Service)** | `usuario@itil.local` | `password123` |

*(The login screen also features quick-select demo buttons to switch between accounts with a single click)*

---

## 🧪 Running Automated Tests

Run the complete test suite (unit models, controllers, and integration flows):

```bash
bin/rails test
```

All tests should pass with 0 failures and 0 errors:
```text
Running 24 tests in a single process
24 runs, 86 assertions, 0 failures, 0 errors, 0 skips
```

---

## 📂 Project Structure

```text
├── app/
│   ├── assets/stylesheets/application.css  # Core design system
│   ├── controllers/
│   │   ├── assets_controller.rb            # ITAM / CMDB management
│   │   ├── dashboard_controller.rb         # Real-time metrics
│   │   ├── kb_articles_controller.rb       # Knowledge Base
│   │   ├── sessions_controller.rb          # Authentication
│   │   ├── ticket_updates_controller.rb    # Timeline follow-ups & tasks
│   │   └── tickets_controller.rb           # Helpdesk & ITIL workflow
│   ├── models/
│   │   ├── asset.rb                        # Hardware asset model
│   │   ├── ticket.rb                       # Ticket with ITIL matrix & SLA
│   │   ├── ticket_update.rb                # Timeline updates
│   │   └── user.rb                         # RBAC model (admin/tech/user)
│   └── views/                              # Responsive view templates
├── config/                                 # Routes, environments & Solid config
├── db/
│   ├── migrate/                            # Active Record migrations
│   ├── schema.rb                           # Database schema
│   └── seeds.rb                            # Sample ITSM & CMDB dataset
└── test/                                   # Model and integration tests
```

---

## 📄 License

This project is open-source software licensed under the [GNU General Public License v3.0](LICENSE).