use crate::types::{PlacementSide, Rect};

/// Places the glass (region zero) beside its anchor. `extent` is how far the window
/// reaches below the glass top (physical): the menu space is reserved under the pill
/// since 2026-09-13, so the side is chosen on the whole window, not on the glass alone.
pub fn overlay(
    anchor: Rect,
    work: Rect,
    width: f64,
    height: f64,
    extent: f64,
    hint: Option<PlacementSide>,
) -> (Rect, PlacementSide) {
    let gap = 8.0;
    let decision_height = if hint.is_none() {
        height.max(220.0).max(extent)
    } else {
        height
    };
    let below_fits = anchor.y + anchor.height + gap + decision_height <= work.y + work.height;
    let side = hint.unwrap_or(if below_fits {
        PlacementSide::Below
    } else {
        PlacementSide::Above
    });
    let raw_y = match side {
        PlacementSide::Below => anchor.y + anchor.height + gap,
        _ => anchor.y - height - gap,
    };
    let width = width.min(work.width);
    let height = height.min(work.height);
    let x = (anchor.x + anchor.width - width).clamp(work.x, work.x + work.width - width);
    let y = raw_y.clamp(work.y, work.y + work.height - height);
    (
        Rect {
            x,
            y,
            width,
            height,
        },
        side,
    )
}

/// Docked window: bottom-centre of the work area, 8 logical px above its bottom edge.
/// The frontend keeps the tab on the window's bottom edge, so a taller window only
/// moves the top edge.
/// Bottom-centre, resting on the work area: the window's own bottom halo (frontend
/// padding for the tab shadow) keeps the tab off the taskbar.
pub fn docked(work: Rect, width: f64, height: f64) -> Rect {
    clamp(work, work.x + (work.width - width) / 2., work.y + work.height - height, width, height)
}

pub fn clamp(work: Rect, x: f64, y: f64, width: f64, height: f64) -> Rect {
    let width = width.min(work.width);
    let height = height.min(work.height);
    Rect {
        x: x.clamp(work.x, work.x + work.width - width),
        y: y.clamp(work.y, work.y + work.height - height),
        width,
        height,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn chooses_above_at_bottom_and_keeps_hint() {
        let work = Rect {
            x: 0.,
            y: 0.,
            width: 1000.,
            height: 800.,
        };
        let a = Rect {
            x: 900.,
            y: 760.,
            width: 20.,
            height: 20.,
        };
        let (r, s) = overlay(a, work, 280., 200., 200., None);
        assert_eq!(s, PlacementSide::Above);
        assert!(r.x + r.width <= 1000.);
        assert_eq!(
            overlay(a, work, 280., 300., 300., Some(s)).1,
            PlacementSide::Above
        );
    }
    #[test]
    fn the_reserved_window_below_the_glass_decides_the_side() {
        let work = Rect { x: 0., y: 0., width: 1000., height: 800. };
        // 300 px of room below the anchor: a 120 px glass fits, a 334 px window does not.
        let a = Rect { x: 400., y: 480., width: 20., height: 20. };
        assert_eq!(overlay(a, work, 280., 120., 120., None).1, PlacementSide::Below);
        assert_eq!(overlay(a, work, 280., 120., 334., None).1, PlacementSide::Above);
        // A chosen side is kept whatever the extent.
        assert_eq!(overlay(a, work, 280., 120., 334., Some(PlacementSide::Below)).1, PlacementSide::Below);
    }
    #[test]
    fn reserves_long_result_on_first_choice() {
        let work = Rect {
            x: 0.,
            y: 0.,
            width: 1000.,
            height: 800.,
        };
        let a = Rect {
            x: 400.,
            y: 650.,
            width: 20.,
            height: 20.,
        };
        assert_eq!(overlay(a, work, 280., 40., 40., None).1, PlacementSide::Above);
    }
    #[test]
    fn manual_position_stays_in_offset_work_area_after_resize() {
        let work = Rect {
            x: -1920.,
            y: 40.,
            width: 1920.,
            height: 1040.,
        };
        assert_eq!(
            clamp(work, -50., 1000., 420., 440.),
            Rect {
                x: -420.,
                y: 640.,
                width: 420.,
                height: 440.,
            }
        );
    }
    #[test]
    fn docked_window_rests_on_the_bottom_edge_of_a_negative_work_area() {
        let work = Rect { x: -1600., y: -200., width: 1600., height: 1200. };
        assert_eq!(docked(work, 300., 40.), Rect { x: -950., y: 960., width: 300., height: 40. });
        // Growing upward: same bottom edge for a taller window.
        let tall = docked(work, 300., 260.);
        assert_eq!(tall.y + tall.height, 1000.);
    }
}
