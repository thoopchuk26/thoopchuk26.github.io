$(document).ready(function() {
  var abilityName;
  $('.randomAbility').click(function(){
    $.ajax({
      dataType: "jsonp",
      jsonpCallback: "parseQuote",
      url: "http://ddragon.leagueoflegends.com/cdn/11.17.1/data/en_US/champion.json",
      success: function(results) {
        $.ajax({
          dataType: "jsonp",
          jsonpCallback: "parseQuote",
          url: `http://ddragon.leagueoflegends.com/cdn/11.17.1/data/en_US/${results["name"]}.json`,
          success: function(results) {
            abilityName = results["spells"];
            $('#ability').attr("src", abilityName);
            var noSpace = abilityName.replace(/\s/g, '+');
            $.ajax({
              dataType: "jsonp",
              jsonpCallback: "parseQuote",
              url: `https://api.spotify.com/v1/search?q=track"'${noSpace}'"/images`,
              success: function(results){
                $('abilityPic').attr('src', results);
              },
            })
          },
        })
      },
      error: function(xhr,status,error) {
        console.log(error);
      },
    })

  $('.songTitle').click(function(){
    $.ajax({
      dataType: "jsonp",
      jsonpCallback: "parseQuote",
      url: `https://api.spotify.com/v1/search/${abilityName}`,
      success: function(results){
        $('#song').attr("src", results["Name"]);
        var noSpace = abilityName.replace(/\s/g, '');
        $.ajax({
          dataType: "jsonp",
          jsonpCallback: "parseQuote",
          url: `http://ddragon.leagueoflegends.com/cdn/11.17.1/img/spell/${noSpace}.png`,
          success: function(results){
            $('abilityPic').attr('src', results);
          }
        })
      },
      error: function(xhr,status,error){
        console.log(error);
      },
    })
  })
})
