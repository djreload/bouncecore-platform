package uk.co.bouncecore.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

final class NotificationChannels {
    static final String DEFAULT_CHANNEL_ID = "bouncecore_notifications";

    private NotificationChannels() {
    }

    static void ensureDefaultChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            DEFAULT_CHANNEL_ID,
            "Bouncecore notifications",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Account, stream, shop, music, and admin notifications.");
        manager.createNotificationChannel(channel);
    }
}
