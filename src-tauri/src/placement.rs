use crate::types::{PlacementSide, Rect};

pub fn overlay(
    anchor: Rect,
    work: Rect,
    width: f64,
    height: f64,
    hint: Option<PlacementSide>,
) -> (Rect, PlacementSide) {
    let gap = 8.0;
    let decision_height = if hint.is_none() {
        height.max(220.0)
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

pub fn capsule(work: Rect, width: f64, height: f64) -> Rect {
    Rect {
        x: work.x + (work.width - width) / 2.0,
        y: work.y + work.height - height - 16.0,
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
        let (r, s) = overlay(a, work, 280., 200., None);
        assert_eq!(s, PlacementSide::Above);
        assert!(r.x + r.width <= 1000.);
        assert_eq!(
            overlay(a, work, 280., 300., Some(s)).1,
            PlacementSide::Above
        );
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
        assert_eq!(overlay(a, work, 280., 40., None).1, PlacementSide::Above);
    }
}
