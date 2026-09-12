require "test_helper"

class ProfileTest < ActiveSupport::TestCase
  test "validates presence and uniqueness of name" do
    p1 = Profile.new(name: "", base_role: "user", color: "#10b981")
    assert_not p1.valid?
    assert_includes p1.errors[:name], "can't be blank"

    existing = profiles(:super_admin)
    p2 = Profile.new(name: existing.name, base_role: "user", color: "#10b981")
    assert_not p2.valid?
    assert_includes p2.errors[:name], "has already been taken"
  end

  test "validates hex color format" do
    p = Profile.new(name: "Test Profile", base_role: "user", color: "invalid-color")
    assert_not p.valid?
    assert_includes p.errors[:color], "is invalid"

    p.color = "#3b82f6"
    assert p.valid?
  end

  test "permissions count reflects active permissions" do
    p = profiles(:super_admin)
    assert_not_nil p
    assert_equal p.total_permissions_count, p.permissions_count
  end

  test "user delegates permissions via can? method" do
    admin = users(:admin)
    tech = users(:tech)
    user = users(:user)

    assert admin.can?(:admin_access)
    assert admin.can?(:ticket_delete)

    assert tech.can?(:ticket_assign)
    assert tech.can?(:ticket_private_notes)
    assert_not tech.can?(:admin_access)

    assert user.can?(:ticket_create)
    assert_not user.can?(:ticket_private_notes)
    assert_not user.can?(:admin_access)
  end
end
