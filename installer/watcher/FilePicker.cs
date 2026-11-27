using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace AgyClaudeStyle.Watcher
{
    /// <summary>
    /// 纯编译原生只读文件/目录选择对话框子命令（--pick-file / --pick-folder）。
    /// 使用 .NET WinForms 原生 STA 对话框，无外部脚本依赖。
    /// </summary>
    internal static class FilePicker
    {
        private const string DefaultMediaFilter =
            "Wallpapers (*.jpg;*.jpeg;*.png;*.webp;*.gif;*.avif;*.mp4;*.webm)|*.jpg;*.jpeg;*.png;*.webp;*.gif;*.avif;*.mp4;*.webm|" +
            "Images (*.jpg;*.jpeg;*.png;*.webp;*.gif;*.avif)|*.jpg;*.jpeg;*.png;*.webp;*.gif;*.avif|" +
            "Videos (*.mp4;*.webm)|*.mp4;*.webm";

        public static bool TryHandleCli(string[] args, out int exitCode)
        {
            exitCode = 0;
            if (args == null || args.Length == 0) return false;

            string mode = null;
            string title = null;
            string filter = null;
            string initialDir = null;
            string outFile = null;
            bool useBase64 = false;

            for (int i = 0; i < args.Length; i++)
            {
                string a = args[i];
                if (a == "--pick-file") mode = "file";
                else if (a == "--pick-folder") mode = "folder";
                else if (a == "--base64") useBase64 = true;
                else if (a == "--title" && i + 1 < args.Length) title = args[++i];
                else if (a == "--filter" && i + 1 < args.Length) filter = args[++i];
                else if (a == "--initial-dir" && i + 1 < args.Length) initialDir = args[++i];
                else if (a == "--out" && i + 1 < args.Length) outFile = args[++i];
            }

            if (string.IsNullOrEmpty(mode)) return false;

            if (string.IsNullOrEmpty(title))
            {
                title = Environment.GetEnvironmentVariable("AG_PRISM_PICK_TITLE");
            }
            if (string.IsNullOrEmpty(initialDir))
            {
                initialDir = Environment.GetEnvironmentVariable("AG_PRISM_PICK_INIT_DIR");
            }

            try
            {
                string selected = RunInSta(mode, title, filter, initialDir);
                WriteSelection(selected, outFile, useBase64);
                exitCode = 0;
            }
            catch (Exception ex)
            {
                try
                {
                    using (Stream stderr = Console.OpenStandardError())
                    {
                        byte[] errBytes = new UTF8Encoding(false).GetBytes(ex.Message ?? "picker failed");
                        stderr.Write(errBytes, 0, errBytes.Length);
                        stderr.Flush();
                    }
                }
                catch { }
                exitCode = 1;
            }
            return true;
        }

        private static string RunInSta(string mode, string title, string filter, string initialDir)
        {
            if (Thread.CurrentThread.GetApartmentState() == ApartmentState.STA)
            {
                return ShowDialogOnSta(mode, title, filter, initialDir);
            }

            string result = "";
            Exception captured = null;
            Thread staThread = new Thread(delegate()
            {
                try
                {
                    result = ShowDialogOnSta(mode, title, filter, initialDir);
                }
                catch (Exception ex)
                {
                    captured = ex;
                }
            });
            staThread.SetApartmentState(ApartmentState.STA);
            staThread.Start();
            staThread.Join();
            if (captured != null) throw captured;
            return result;
        }

        private static string ShowDialogOnSta(string mode, string title, string filter, string initialDir)
        {
            Application.EnableVisualStyles();
            using (Form owner = new Form())
            {
                owner.TopMost = true;
                owner.ShowInTaskbar = false;
                owner.StartPosition = FormStartPosition.CenterScreen;
                owner.Opacity = 0;
                owner.Width = 1;
                owner.Height = 1;
                owner.Show();

                if (mode == "folder")
                {
                    using (FolderBrowserDialog dlg = new FolderBrowserDialog())
                    {
                        if (!string.IsNullOrEmpty(title))
                        {
                            dlg.Description = title;
                        }
                        if (!string.IsNullOrEmpty(initialDir) && Directory.Exists(initialDir))
                        {
                            dlg.SelectedPath = initialDir;
                        }
                        dlg.ShowNewFolderButton = true;
                        DialogResult res = dlg.ShowDialog(owner);
                        return (res == DialogResult.OK && !string.IsNullOrEmpty(dlg.SelectedPath))
                            ? dlg.SelectedPath
                            : "";
                    }
                }

                using (OpenFileDialog dlg = new OpenFileDialog())
                {
                    dlg.Title = string.IsNullOrEmpty(title) ? "Select Wallpaper (Image / Video)" : title;
                    dlg.Filter = string.IsNullOrEmpty(filter) ? DefaultMediaFilter : filter;
                    if (!string.IsNullOrEmpty(initialDir) && Directory.Exists(initialDir))
                    {
                        dlg.InitialDirectory = initialDir;
                    }
                    dlg.CheckFileExists = true;
                    dlg.Multiselect = false;
                    dlg.DereferenceLinks = true;
                    dlg.RestoreDirectory = true;
                    DialogResult res = dlg.ShowDialog(owner);
                    return (res == DialogResult.OK && !string.IsNullOrEmpty(dlg.FileName))
                        ? dlg.FileName
                        : "";
                }
            }
        }

        private static void WriteSelection(string selected, string outFile, bool useBase64)
        {
            UTF8Encoding utf8NoBom = new UTF8Encoding(false);
            string payload = "";
            if (!string.IsNullOrEmpty(selected))
            {
                payload = useBase64
                    ? Convert.ToBase64String(utf8NoBom.GetBytes(selected))
                    : selected;
            }
            if (!string.IsNullOrEmpty(outFile))
            {
                File.WriteAllText(outFile, payload, utf8NoBom);
                return;
            }
            if (payload.Length > 0)
            {
                using (Stream stdout = Console.OpenStandardOutput())
                {
                    byte[] bytes = utf8NoBom.GetBytes(payload);
                    stdout.Write(bytes, 0, bytes.Length);
                    stdout.Flush();
                }
            }
        }
    }
}
