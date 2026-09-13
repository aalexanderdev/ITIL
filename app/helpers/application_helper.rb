module ApplicationHelper
  def render_brand_logo(setting, size: 22, stroke_width: 2.2, css_class: "")
    if setting.logo_url.present?
      image_tag(setting.logo_url, alt: setting.app_name, width: size, height: size, style: "object-fit: contain;", class: css_class)
    else
      setting.render_logo_svg(size: size, stroke_width: stroke_width, css_class: css_class)
    end
  end
end
