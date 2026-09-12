require "test_helper"

class AssetTest < ActiveSupport::TestCase
  test "auto generates asset_tag with type prefix" do
    asset_pc = Asset.create!(
      name: "Laptop Dell",
      asset_type: "computer",
      status: "in_use"
    )
    assert_match(/^PC-/, asset_pc.asset_tag)

    asset_srv = Asset.create!(
      name: "Servidor Web",
      asset_type: "server",
      status: "in_use"
    )
    assert_match(/^SRV-/, asset_srv.asset_tag)
  end

  test "returns correct type name and status badge class" do
    asset = Asset.create!(
      name: "Switch Core",
      asset_type: "network_device",
      status: "in_use"
    )
    assert_equal "Dispositivo de Red", asset.type_name
    assert_equal "badge-success", asset.status_badge_class
  end
end
