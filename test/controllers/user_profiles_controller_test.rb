require "test_helper"

class UserProfilesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:user)
  end

  test "unauthenticated user is redirected to login" do
    get user_profile_path
    assert_redirected_to new_session_path
  end

  test "authenticated user can view their personal profile with assigned assets" do
    asset = Asset.create!(
      name: "Laptop ThinkPad T14",
      asset_type: "computer",
      status: "in_use",
      manufacturer: "Lenovo",
      model: "T14 Gen 3",
      user: @user
    )

    sign_in_as(@user)
    get user_profile_path
    assert_response :success
    assert_select "h1", "Mi Perfil"
    assert_includes response.body, @user.email_address
    assert_includes response.body, asset.name
    assert_includes response.body, asset.type_name
  end

  test "authenticated user can edit and update their personal info" do
    sign_in_as(@user)
    get edit_user_profile_path
    assert_response :success

    patch user_profile_path, params: {
      user: {
        first_name: "NombreModificado",
        last_name: "ApellidoModificado",
        phone: "+54 11 4444-5555"
      }
    }

    assert_redirected_to user_profile_path
    @user.reload
    assert_equal "NombreModificado", @user.first_name
    assert_equal "ApellidoModificado", @user.last_name
    assert_equal "+54 11 4444-5555", @user.phone
  end

  test "user cannot update password with invalid current password" do
    sign_in_as(@user)
    patch update_password_user_profile_path, params: {
      current_password: "wrong-password",
      password: "newsecretpassword",
      password_confirmation: "newsecretpassword"
    }

    assert_redirected_to edit_user_profile_path
    follow_redirect!
    assert_match "incorrecta", response.body
  end

  test "user can update password with correct current password" do
    sign_in_as(@user)
    patch update_password_user_profile_path, params: {
      current_password: "password",
      password: "brandnewpassword123",
      password_confirmation: "brandnewpassword123"
    }

    assert_redirected_to user_profile_path
    follow_redirect!
    assert_match "actualizada exitosamente", response.body

    assert @user.reload.authenticate("brandnewpassword123")
  end
end
