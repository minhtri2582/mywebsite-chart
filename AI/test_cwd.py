import os
with open("current_dir_file.txt", "w") as f:
    f.write(os.getcwd())
