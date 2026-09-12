require "test_helper"

class ProfilesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @user = users(:user)
    @profile = profiles(:self_service)
  end

  test "non-admin users cannot access profiles administration" do
    sign_in_as(@user)
    get profiles_path
    assert_redirected_to root_path

    get new_profile_path
    assert_redirected_to root_path

    get edit_profile_path(@profile)
    assert_redirected_to root_path
  end

  test "admin can list profiles" do
    sign_in_as(@admin)
    get profiles_path
    assert_response :success
    assert_select "h1", "Perfiles y Permisos (RBAC)"
  end

  test "admin can create a new profile with custom permissions" do
    sign_in_as(@admin)
    assert_difference "Profile.count", 1 do
      post profiles_path, params: {
        profile: {
          name: "Soporte Nivel 2",
          description: "Técnicos avanzados de infraestructura",
          color: "#8b5cf6",
          base_role: "technician",
          ticket_create: true,
          ticket_edit: true,
          ticket_assign: true,
          ticket_solve: true,
          ticket_private_notes: true,
          asset_view: true,
          asset_manage: true
        }
      }
    end

    assert_redirected_to profiles_path
    new_p = Profile.find_by(name: "Soporte Nivel 2")
    assert_not_nil new_p
    assert_equal true, new_p.ticket_solve
    assert_equal true, new_p.asset_manage
    assert_equal false, new_p.admin_access
  end

  test "admin can view and update a profile" do
    sign_in_as(@admin)
    get profile_path(@profile)
    assert_response :success

    patch profile_path(@profile), params: {
      profile: {
        description: "Nueva descripción actualizada",
        chat_convert_ticket: true
      }
    }

    assert_redirected_to profiles_path
    @profile.reload
    assert_equal "Nueva descripción actualizada", @profile.description
    assert_equal true, @profile.chat_convert_ticket
  end
end
