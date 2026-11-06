import { assert, mutate } from "../../../shared/data/store";
import { STEP3_API } from "../../registration/services/assignment-api";
import { apiData } from "../../../shared/api/api-data";
export const notificationService = {
  read(id: string) {
    if (STEP3_API) return apiData("PATCH", `/notifications/${id}/read`);
    return mutate("Đọc thông báo", undefined, (db, user) => {
      const item = db.notifications.find((n) => n.id === id);
      assert(
        item && item.userId === user.id,
        "Không thể đọc thông báo của người dùng khác",
      );
      item.read = true;
    });
  },
  readAll() {
    if (STEP3_API) return apiData("PATCH", "/notifications/me/read");
    return mutate("Đọc tất cả thông báo", undefined, (db, user) => {
      db.notifications
        .filter((n) => n.userId === user.id)
        .forEach((n) => (n.read = true));
    });
  },
};
