{
  description = "Offline PlantUML editor development and isolated VS Code";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "aarch64-darwin" "aarch64-linux" "x86_64-linux" ];
      eachSystem = nixpkgs.lib.genAttrs systems;
      forSystem = system:
        let
          pkgs = import nixpkgs { inherit system; config.allowUnfree = true; };
          launcher = pkgs.writeShellApplication {
            name = "plantuml-vscode";
            runtimeInputs = [ pkgs.bun pkgs.nodejs_22 pkgs.vscode ];
            text = ''
              export PLANTUML_VSCODE_CLI="${pkgs.vscode}/bin/code"
              exec bun ${./scripts/launch-vscode.ts} "$@"
            '';
          };
        in { inherit pkgs launcher; };
    in {
      devShells = eachSystem (system:
        let env = forSystem system; in {
          default = env.pkgs.mkShell {
            packages = [ env.pkgs.bun env.pkgs.nodejs_22 env.pkgs.git env.launcher ];
          };
        });
      packages = eachSystem (system: { default = (forSystem system).launcher; });
      apps = eachSystem (system: {
        default = self.apps.${system}.vscode;
        vscode = {
          type = "app";
          program = "${(forSystem system).launcher}/bin/plantuml-vscode";
          meta.description = "Build and launch the extension in a fresh VS Code profile";
        };
      });
    };
}
