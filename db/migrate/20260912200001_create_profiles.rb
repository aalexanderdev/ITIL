class CreateProfiles < ActiveRecord::Migration[8.0]
  def up
    create_table :profiles do |t|
      t.string :name, null: false
      t.text :description
      t.string :color, default: "#4f46e5", null: false
      t.string :base_role, default: "user", null: false

      # Permisos de Tickets (Helpdesk)
      t.boolean :ticket_all_view, default: false, null: false
      t.boolean :ticket_create, default: true, null: false
      t.boolean :ticket_edit, default: false, null: false
      t.boolean :ticket_assign, default: false, null: false
      t.boolean :ticket_solve, default: false, null: false
      t.boolean :ticket_close, default: false, null: false
      t.boolean :ticket_delete, default: false, null: false
      t.boolean :ticket_private_notes, default: false, null: false

      # Permisos de Activos (CMDB / ITAM)
      t.boolean :asset_view, default: true, null: false
      t.boolean :asset_manage, default: false, null: false

      # Permisos de Base de Conocimiento (FAQ)
      t.boolean :kb_view, default: true, null: false
      t.boolean :kb_manage, default: false, null: false

      # Permisos de HelpdeskChat
      t.boolean :chat_access, default: true, null: false
      t.boolean :chat_convert_ticket, default: false, null: false
      t.boolean :chat_config, default: false, null: false

      # Permisos de Administración
      t.boolean :admin_access, default: false, null: false

      t.boolean :is_default, default: false, null: false

      t.timestamps
    end

    add_index :profiles, :name, unique: true
    add_reference :users, :profile, foreign_key: true, null: true

    # Crear perfiles estándar iniciales
    execute(<<-SQL) rescue nil
      INSERT INTO profiles (
        name, description, color, base_role,
        ticket_all_view, ticket_create, ticket_edit, ticket_assign, ticket_solve, ticket_close, ticket_delete, ticket_private_notes,
        asset_view, asset_manage, kb_view, kb_manage, chat_access, chat_convert_ticket, chat_config, admin_access, is_default,
        created_at, updated_at
      ) VALUES (
        'Super-Administrador', 'Control total de la mesa de ayuda, activos, usuarios, perfiles y configuraciones del sistema',
        '#4f46e5', 'admin',
        1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 0,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    SQL

    execute(<<-SQL) rescue nil
      INSERT INTO profiles (
        name, description, color, base_role,
        ticket_all_view, ticket_create, ticket_edit, ticket_assign, ticket_solve, ticket_close, ticket_delete, ticket_private_notes,
        asset_view, asset_manage, kb_view, kb_manage, chat_access, chat_convert_ticket, chat_config, admin_access, is_default,
        created_at, updated_at
      ) VALUES (
        'Técnico Especialista TI', 'Gestión operativa de incidencias, notas técnicas internas, asignación y catálogo de activos',
        '#0284c7', 'technician',
        1, 1, 1, 1, 1, 1, 0, 1,
        1, 1, 1, 1, 1, 1, 0, 0, 0,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    SQL

    execute(<<-SQL) rescue nil
      INSERT INTO profiles (
        name, description, color, base_role,
        ticket_all_view, ticket_create, ticket_edit, ticket_assign, ticket_solve, ticket_close, ticket_delete, ticket_private_notes,
        asset_view, asset_manage, kb_view, kb_manage, chat_access, chat_convert_ticket, chat_config, admin_access, is_default,
        created_at, updated_at
      ) VALUES (
        'Usuario Autoservicio', 'Apertura de solicitudes, seguimiento de tickets propios, consulta de equipos a cargo y chat',
        '#10b981', 'user',
        0, 1, 0, 0, 0, 0, 0, 0,
        1, 0, 1, 0, 1, 0, 0, 0, 1,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    SQL

    execute(<<-SQL) rescue nil
      INSERT INTO profiles (
        name, description, color, base_role,
        ticket_all_view, ticket_create, ticket_edit, ticket_assign, ticket_solve, ticket_close, ticket_delete, ticket_private_notes,
        asset_view, asset_manage, kb_view, kb_manage, chat_access, chat_convert_ticket, chat_config, admin_access, is_default,
        created_at, updated_at
      ) VALUES (
        'Auditor / Observador', 'Consulta y auditoría de tickets, métricas de panel y activos sin permisos de modificación',
        '#64748b', 'user',
        1, 0, 0, 0, 0, 0, 0, 0,
        1, 0, 1, 0, 1, 0, 0, 0, 0,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    SQL

    # Asociar usuarios existentes al perfil coincidente
    execute(<<-SQL) rescue nil
      UPDATE users SET profile_id = (SELECT id FROM profiles WHERE base_role = 'admin' LIMIT 1) WHERE role = 'admin';
    SQL
    execute(<<-SQL) rescue nil
      UPDATE users SET profile_id = (SELECT id FROM profiles WHERE base_role = 'technician' LIMIT 1) WHERE role = 'technician';
    SQL
    execute(<<-SQL) rescue nil
      UPDATE users SET profile_id = (SELECT id FROM profiles WHERE base_role = 'user' AND is_default = 1 LIMIT 1) WHERE role = 'user';
    SQL
  end

  def down
    remove_reference :users, :profile
    drop_table :profiles
  end
end
