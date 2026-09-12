# Seed data for ITIL / GLPI-like system

puts "Limpiando base de datos..."
ChatMessageReaction.destroy_all if defined?(ChatMessageReaction)
ChatMessage.destroy_all if defined?(ChatMessage)
ChatConversationUser.destroy_all if defined?(ChatConversationUser)
ChatConversation.destroy_all if defined?(ChatConversation)
ChatPresence.destroy_all if defined?(ChatPresence)
Session.destroy_all if defined?(Session)
TicketUpdate.destroy_all
Ticket.destroy_all
Asset.destroy_all
KbArticle.destroy_all
TicketCategory.destroy_all
User.destroy_all
Profile.destroy_all if defined?(Profile)
Department.destroy_all
Location.destroy_all

puts "Creando Sedes y Ubicaciones..."
loc_central = Location.create!(
  name: "Sede Central",
  building: "Torre A",
  floor: "4",
  room: "402 - Operaciones TI",
  description: "Edificio corporativo principal"
)

loc_norte = Location.create!(
  name: "Sucursal Norte",
  building: "Edificio Logístico",
  floor: "1",
  room: "Atención al Cliente",
  description: "Centro de distribución y ventas"
)

loc_dc = Location.create!(
  name: "Datacenter Principal",
  building: "Torre Tecnológica",
  floor: "Sótano 1",
  room: "Sala Servidores",
  description: "Infraestructura crítica y servidores"
)

puts "Creando Departamentos..."
dep_ti = Department.create!(name: "Tecnología e Infraestructura (TI)", code: "IT-01", location: loc_central)
dep_rrhh = Department.create!(name: "Recursos Humanos y Talento", code: "HR-01", location: loc_central)
dep_fin = Department.create!(name: "Finanzas y Contabilidad", code: "FIN-01", location: loc_central)
dep_ops = Department.create!(name: "Operaciones y Logística", code: "OPS-01", location: loc_norte)

puts "Creando Categorías de Tickets..."
cat_hw = TicketCategory.create!(name: "Hardware y Equipos", description: "Laptops, periféricos, monitores y componentes", color: "#3b82f6")
cat_net = TicketCategory.create!(name: "Redes y Conectividad", description: "WiFi, switches, VPN, cableado e internet", color: "#6366f1")
cat_sw = TicketCategory.create!(name: "Software y Sistemas", description: "Instalación de programas, errores de SO y licencias", color: "#8b5cf6")
cat_acc = TicketCategory.create!(name: "Accesos y Cuentas", description: "Contraseñas, permisos de red, correos y ERP", color: "#ec4899")
cat_prn = TicketCategory.create!(name: "Impresoras y Escáneres", description: "Tóner, atascos y configuración de red", color: "#f59e0b")

puts "Creando Perfiles y Permisos (RBAC)..."
prof_admin = Profile.find_or_create_by!(name: "Super-Administrador") do |p|
  p.description = "Control total de la mesa de ayuda, activos, usuarios, perfiles y configuraciones del sistema"
  p.color = "#4f46e5"
  p.base_role = "admin"
  p.ticket_all_view = true
  p.ticket_create = true
  p.ticket_edit = true
  p.ticket_assign = true
  p.ticket_solve = true
  p.ticket_close = true
  p.ticket_delete = true
  p.ticket_private_notes = true
  p.asset_view = true
  p.asset_manage = true
  p.kb_view = true
  p.kb_manage = true
  p.chat_access = true
  p.chat_convert_ticket = true
  p.chat_config = true
  p.admin_access = true
  p.is_default = false
end

prof_tech = Profile.find_or_create_by!(name: "Técnico Especialista TI") do |p|
  p.description = "Gestión operativa de incidencias, notas técnicas internas, asignación y catálogo de activos"
  p.color = "#0284c7"
  p.base_role = "technician"
  p.ticket_all_view = true
  p.ticket_create = true
  p.ticket_edit = true
  p.ticket_assign = true
  p.ticket_solve = true
  p.ticket_close = true
  p.ticket_delete = false
  p.ticket_private_notes = true
  p.asset_view = true
  p.asset_manage = true
  p.kb_view = true
  p.kb_manage = true
  p.chat_access = true
  p.chat_convert_ticket = true
  p.chat_config = false
  p.admin_access = false
  p.is_default = false
end

prof_user = Profile.find_or_create_by!(name: "Usuario Autoservicio") do |p|
  p.description = "Apertura de solicitudes, seguimiento de tickets propios, consulta de equipos a cargo y chat"
  p.color = "#10b981"
  p.base_role = "user"
  p.ticket_all_view = false
  p.ticket_create = true
  p.ticket_edit = false
  p.ticket_assign = false
  p.ticket_solve = false
  p.ticket_close = false
  p.ticket_delete = false
  p.ticket_private_notes = false
  p.asset_view = true
  p.asset_manage = false
  p.kb_view = true
  p.kb_manage = false
  p.chat_access = true
  p.chat_convert_ticket = false
  p.chat_config = false
  p.admin_access = false
  p.is_default = true
end

puts "Creando Usuarios..."
admin = User.create!(
  email_address: "admin@itil.local",
  password: "password123",
  first_name: "Administrador",
  last_name: "Sistema",
  role: "admin",
  profile: prof_admin,
  phone: "+1 555-0100",
  department: dep_ti,
  active: true
)

tech1 = User.create!(
  email_address: "tecnico@itil.local",
  password: "password123",
  first_name: "Carlos",
  last_name: "Gómez",
  role: "technician",
  profile: prof_tech,
  phone: "+1 555-0101",
  department: dep_ti,
  active: true
)

tech2 = User.create!(
  email_address: "soporte@itil.local",
  password: "password123",
  first_name: "Laura",
  last_name: "Méndez",
  role: "technician",
  profile: prof_tech,
  phone: "+1 555-0102",
  department: dep_ti,
  active: true
)

user1 = User.create!(
  email_address: "usuario@itil.local",
  password: "password123",
  first_name: "Juan",
  last_name: "Pérez",
  role: "user",
  profile: prof_user,
  phone: "+1 555-0201",
  department: dep_fin,
  active: true
)

user2 = User.create!(
  email_address: "maria@itil.local",
  password: "password123",
  first_name: "María",
  last_name: "Rodríguez",
  role: "user",
  profile: prof_user,
  phone: "+1 555-0202",
  department: dep_rrhh,
  active: true
)

puts "Creando Inventario de Activos (CMDB)..."
asset1 = Asset.create!(
  asset_tag: "PC-00101",
  name: "Laptop Dell Latitude 5420",
  asset_type: "computer",
  manufacturer: "Dell",
  model: "Latitude 5420 Core i7",
  serial_number: "DL-987421-X",
  status: "in_use",
  user: user1,
  department: dep_fin,
  location: loc_central,
  ip_address: "192.168.10.45",
  mac_address: "3C:52:82:11:AB:90",
  operating_system: "Windows 11 Pro 64-bit",
  cpu: "Intel Core i7-1185G7 @ 3.0GHz",
  ram_gb: 16,
  storage_capacity: "512 GB NVMe SSD",
  purchase_date: 1.year.ago,
  warranty_expiry: 2.years.from_now,
  notes: "Equipo asignado con cargador tipo C y funda de transporte."
)

asset2 = Asset.create!(
  asset_tag: "SRV-0005",
  name: "Servidor Aplicaciones ERP",
  asset_type: "server",
  manufacturer: "HPE",
  model: "ProLiant DL380 Gen10",
  serial_number: "HP-SRV-2023-99",
  status: "in_use",
  user: admin,
  department: dep_ti,
  location: loc_dc,
  ip_address: "10.0.1.10",
  mac_address: "00:1E:67:84:92:DF",
  operating_system: "Ubuntu Server 24.04 LTS",
  cpu: "2x Intel Xeon Silver 4210R",
  ram_gb: 64,
  storage_capacity: "4x 1.2TB SAS RAID 10",
  purchase_date: 2.years.ago,
  warranty_expiry: 1.year.from_now,
  notes: "Servidor de base de datos y servicios core en Datacenter."
)

asset3 = Asset.create!(
  asset_tag: "NET-0042",
  name: "Switch Core Piso 4",
  asset_type: "network_device",
  manufacturer: "Cisco",
  model: "Catalyst 2960-X 48 GigE",
  serial_number: "FOC2241R0AB",
  status: "in_use",
  department: dep_ti,
  location: loc_central,
  ip_address: "192.168.1.254",
  mac_address: "00:27:0D:33:14:00",
  notes: "Switch de distribución para estaciones de trabajo piso 4."
)

asset4 = Asset.create!(
  asset_tag: "PRN-0012",
  name: "Impresora Multifuncional Finanzas",
  asset_type: "printer",
  manufacturer: "HP",
  model: "LaserJet Enterprise M528dn",
  serial_number: "VNC3K04182",
  status: "in_use",
  department: dep_fin,
  location: loc_central,
  ip_address: "192.168.10.200",
  mac_address: "A4:5D:36:11:C4:58",
  notes: "Impresora láser monocromática departamental."
)

asset5 = Asset.create!(
  asset_tag: "PC-00102",
  name: "Laptop Lenovo ThinkPad T14",
  asset_type: "computer",
  manufacturer: "Lenovo",
  model: "ThinkPad T14 Gen 3",
  serial_number: "PF-388271",
  status: "in_stock",
  department: dep_ti,
  location: loc_central,
  operating_system: "Windows 11 Pro",
  cpu: "AMD Ryzen 7 PRO 6850U",
  ram_gb: 32,
  storage_capacity: "1 TB SSD",
  purchase_date: 3.months.ago,
  warranty_expiry: 3.years.from_now,
  notes: "Equipo listo para entrega en almacén de TI."
)

puts "Creando Tickets de Ejemplo (ITSM / Helpdesk)..."

# Ticket 1: Incidencia con Laptop de Juan
t1 = Ticket.create!(
  ticket_type: "incident",
  title: "Pantalla azul (BSOD) al iniciar videoconferencias",
  description: "Desde ayer, cada vez que abro Teams o Zoom con la cámara encendida, la laptop arroja pantalla azul 'KERNEL_SECURITY_CHECK_FAILURE' y se reinicia.",
  status: "in_progress",
  urgency: 4,
  impact: 3,
  requester: user1,
  assigned_to: tech1,
  asset: asset1,
  ticket_category: cat_hw
)

TicketUpdate.create!(
  ticket: t1,
  user: user1,
  update_type: "comment",
  content: "Adjunto el código de error. Ocurre especialmente al conectar la cámara externa por USB."
)

TicketUpdate.create!(
  ticket: t1,
  user: tech1,
  update_type: "private_note",
  content: "Revisando dumps de memoria. Parece conflicto con el controlador de la cámara integrada Realtek y la actualización de Windows."
)

TicketUpdate.create!(
  ticket: t1,
  user: tech1,
  update_type: "task",
  content: "Actualizar controladores de chipset y BIOS a la versión 1.18.2.",
  time_spent_minutes: 45
)

# Ticket 2: Incidencia de Red
t2 = Ticket.create!(
  ticket_type: "incident",
  title: "Caída intermitente de WiFi en ala norte piso 4",
  description: "Varios usuarios en la sala de juntas no pueden mantener conexión estable con la red WiFi ITIL-Corp.",
  status: "assigned",
  urgency: 4,
  impact: 4,
  requester: user2,
  assigned_to: tech2,
  ticket_category: cat_net
)

# Ticket 3: Petición de Servicio
t3 = Ticket.create!(
  ticket_type: "request",
  title: "Solicitud de cuenta VPN y acceso a servidor contable",
  description: "Por favor habilitar credenciales de acceso remoto VPN para trabajo en casa los días viernes.",
  status: "new_ticket",
  urgency: 2,
  impact: 2,
  requester: user1,
  ticket_category: cat_acc
)

# Ticket 4: Resuelto
t4 = Ticket.create!(
  ticket_type: "incident",
  title: "Atasco de papel y error 13.00.00 en impresora departamental",
  description: "La impresora de finanzas no toma hojas de la bandeja 2 y muestra luz ámbar parpadeando.",
  status: "solved",
  urgency: 3,
  impact: 3,
  requester: user1,
  assigned_to: tech1,
  asset: asset4,
  ticket_category: cat_prn,
  resolved_at: 1.hour.ago
)

TicketUpdate.create!(
  ticket: t4,
  user: tech1,
  update_type: "solution",
  content: "Se retiró fragmento de papel atascado en rodillos de tracción y se limpiaron los sensores ópticos de la bandeja 2. Impresión de prueba realizada con éxito.",
  solution_status: "approved"
)

puts "Creando Base de Conocimiento (FAQ)..."
KbArticle.create!(
  title: "Guía de conexión a la red WiFi corporativa ITIL-Secure",
  content: "Para conectarse a la red inalámbrica de la empresa, seleccione el SSID 'ITIL-Secure'. Utilice su usuario y contraseña de dominio corporativo con protocolo WPA2/WPA3 Enterprise. Si su dispositivo requiere certificado de CA, seleccione 'No validar' o solicite el certificado raíz al equipo de TI.",
  ticket_category: cat_net,
  user: admin,
  is_public: true,
  views_count: 142
)

KbArticle.create!(
  title: "Configuración y acceso a la VPN institucional",
  content: "1. Descargue el cliente VPN corporativo desde el portal de autoservicio.\n2. Ingrese el servidor vpn.itil.local en el campo de conexión.\n3. Ingrese sus credenciales y apruebe la notificación de segundo factor (MFA) en su teléfono móvil.\n4. Una vez conectado, podrá acceder a carpetas compartidas y servidores internos.",
  ticket_category: cat_acc,
  user: tech1,
  is_public: true,
  views_count: 98
)

KbArticle.create!(
  title: "Protocolo para reporte de averías de hardware",
  content: "Al reportar un problema en su equipo de cómputo, asegúrese de verificar la etiqueta con el código de activo (ej. PC-00101) ubicada en la parte inferior del equipo. Indique si el problema comenzó tras alguna actualización y adjunte capturas del mensaje de error exacto.",
  ticket_category: cat_hw,
  user: admin,
  is_public: true,
  views_count: 65
)

puts "¡Semillas cargadas exitosamente!"
puts "Usuarios creados:"
puts " - Admin: admin@itil.local / password123"
puts " - Técnico: tecnico@itil.local / password123"
puts " - Soporte: soporte@itil.local / password123"
puts " - Usuario: usuario@itil.local / password123"
